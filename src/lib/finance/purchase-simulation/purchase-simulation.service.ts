import prisma from '@/lib/prisma';
import { formatCalendarDate, parseCalendarDate, parseDateOnly } from '@/lib/calendar-dates';
import { DomainError } from '@/lib/finance/domain-error';
import { getLiquidityProjection } from '@/lib/finance/liquidity-projection.service';
import { cardStatementForCharge } from '@/lib/finance/liquidity-scenario';
import { isFundingWalletType } from '@/lib/finance/wallet-accounting';
import { getFortnightYmdBounds } from '@/lib/fortnight-calendar';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import {
  addMonthsYmd,
  buildPurchasePlan,
  MSI_MONTH_OPTIONS,
  PurchasePlanError,
  type PlanWallet,
  type PurchasePlan,
  type PurchasePlanInput,
} from '@/lib/finance/purchase-simulation/plan';
import {
  buildQuincenaSeries,
  defaultHorizonEnd,
  listQuincenas,
  purchaseFlows,
  quincenaKey,
  verdictFacts,
  type BaselineFlow,
  type QuincenaRow,
  type VerdictFacts,
} from '@/lib/finance/purchase-simulation/series';
import {
  buildDebtSeries,
  type CardDebtInput,
  type DebtSeries,
  type LoanDebtInput,
} from '@/lib/finance/purchase-simulation/debt';
import type { PurchaseSimulationInput } from '@/schemas/purchase-simulation.schema';

/**
 * POST /api/wallets/purchase-simulation (MIC-I17-2). Read-only: it loads the
 * owner's projection once, adds what the projection leaves out (programmed
 * income and expenses in quincenas not created yet, budgets, habitual card
 * consumption past the projected cycles) and compares the series with and
 * without the purchase. Nothing is written.
 */

export class PurchaseSimulationError extends DomainError {
  constructor(
    message: string,
    readonly field: string,
    status = 400,
  ) {
    super('INVALID_PURCHASE_SIMULATION', message, status);
  }
}

export type SimulationWallet = {
  id: number;
  name: string;
  type: string;
  isCard: boolean;
  providerIconKey: string | null;
  balance: number | null;
  debt: number | null;
  limit: number | null;
  available: number | null;
  cutoffDay: number | null;
  dueDay: number | null;
  aprAnnualPct: number | null;
};

export type SimulationAlternative = {
  id: string;
  label: string;
  patch: Partial<PurchaseSimulationInput>;
  current: boolean;
  level: VerdictFacts['level'];
  redCount: number;
  quincenas: number;
  tightestQueda: number;
  regularPayment: number;
  count: number;
  interest: number;
  lastDueDate: string;
};

export type PurchaseSimulationResult = {
  as_of: string;
  until: string;
  starting_liquidity: number;
  last_created_quincena: string | null;
  wallets: SimulationWallet[];
  plan: PurchasePlan;
  series: QuincenaRow[];
  verdict: VerdictFacts;
  debt: DebtSeries;
  alternatives: SimulationAlternative[];
  assumptions: string[];
  card_consumption: { walletId: number; name: string; amount: number }[];
};

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const cents = (n: number) => Math.round(n * 100) / 100;

type Loaded = {
  todayYmd: string;
  untilYmd: string;
  startingLiquidity: number;
  baseline: BaselineFlow[];
  createdKeys: Set<string>;
  lastCreatedKey: string | null;
  cards: CardDebtInput[];
  loans: LoanDebtInput[];
  consumption: { walletId: number; name: string; amount: number }[];
};

/** Days of [start, end] inside [from, to], inclusive. */
const overlapDays = (start: string, end: string, from: string, to: string): number => {
  const a = start > from ? start : from;
  const b = end < to ? end : to;
  if (a > b) return 0;
  return Math.round((parseCalendarDate(b).getTime() - parseCalendarDate(a).getTime()) / 86_400_000) + 1;
};

const loadBaseline = async (
  ownerFilter: OwnerFilter,
  wallets: SimulationWallet[],
  todayYmd: string,
  untilYmd: string,
  asOf: Date,
): Promise<Loaded> => {
  const projection = await getLiquidityProjection({
    ownerFilter,
    asOf,
    until: parseCalendarDate(untilYmd),
    omitZeroObligations: true,
    includeUnpaidExpenses: true,
    includeExpenseTemplates: true,
  });

  const baseline: BaselineFlow[] = [];
  const statementByCard = new Map<number, { date: string; amount: number }[]>();
  for (const milestone of projection.milestones) {
    for (const o of milestone.obligations) {
      const date = milestone.due_date;
      const amount = o.next_due_payment;
      if (o.source === 'credit_card_statement') {
        const list = statementByCard.get(o.wallet_id) ?? [];
        list.push({ date, amount });
        statementByCard.set(o.wallet_id, list);
        baseline.push({ date, amount, kind: 'card', name: `Pago ${o.wallet_name}`, walletName: o.wallet_name, estimated: false });
      } else if (o.source === 'loan_payment') {
        baseline.push({ date, amount, kind: 'loan', name: o.loan_name ?? 'Préstamo', walletName: o.wallet_name, estimated: false });
      } else if (o.source === 'expense_template') {
        baseline.push({ date, amount, kind: 'template', name: o.template_name ?? 'Gasto programado', walletName: o.wallet_name, estimated: false });
      } else if (o.source === 'unpaid_expense') {
        baseline.push({ date, amount, kind: 'expense', name: o.expense_description ?? 'Gasto', walletName: o.wallet_name, estimated: false });
      }
    }
  }
  for (const income of projection.income_dates ?? []) {
    baseline.push({ date: income.date, amount: income.amount, kind: 'income', name: income.title, walletName: 'Ingreso', estimated: false });
  }

  const refs = listQuincenas(todayYmd, untilYmd);
  const [fortnights, expenseTemplates, incomeTemplates, budgets, loanPayments] = await Promise.all([
    prisma.fortnight.findMany({
      where: { ...ownerFilter },
      select: { year: true, month: true, period: true },
    }),
    prisma.expenseTemplate.findMany({
      where: { ...ownerFilter, active: true, category_id: { not: null }, wallet_id: { not: null } },
      select: { name: true, suggested_amount: true, wallet_id: true, applies_first_fortnight: true, applies_second_fortnight: true },
    }),
    prisma.incomeTemplate.findMany({
      where: { ...ownerFilter, active: true },
      select: { name: true, suggested_amount: true, applies_first_fortnight: true, applies_second_fortnight: true },
    }),
    prisma.budget.findMany({
      where: { ...ownerFilter, active: true },
      select: { name: true, total_amount: true, frequency: true, start_date: true, end_date: true, recurrent: true },
    }),
    prisma.loanPayment.findMany({
      where: {
        status: 'SCHEDULED',
        due_date: { gte: parseDateOnly(todayYmd) },
        loan: { ...ownerFilter, status: 'ACTIVE' },
      },
      select: { amount: true, due_date: true, loan: { select: { id: true, name: true } } },
    }),
  ]);

  const createdKeys = new Set(
    fortnights.map((f) => quincenaKey({ year: f.year, month: f.month, period: f.period })),
  );
  let lastCreatedKey: string | null = null;
  for (const key of createdKeys) if (!lastCreatedKey || key > lastCreatedKey) lastCreatedKey = key;

  const walletName = new Map(wallets.map((w) => [w.id, w]));
  for (const ref of refs) {
    const key = quincenaKey(ref);
    const { startYmd, endYmd } = getFortnightYmdBounds(ref.year, ref.month, ref.period);
    const first = ref.period === 'FIRST';

    // Virtual quincena: what Crear mes would add, dated like the projection (end of the quincena).
    if (!createdKeys.has(key)) {
      for (const t of expenseTemplates) {
        if (!(first ? t.applies_first_fortnight : t.applies_second_fortnight)) continue;
        const w = t.wallet_id != null ? walletName.get(t.wallet_id) : undefined;
        if (!w || w.isCard) continue;
        const amount = num(t.suggested_amount);
        if (amount <= 0) continue;
        baseline.push({ date: endYmd, amount, kind: 'template', name: t.name, walletName: w.name, estimated: true });
      }
      for (const t of incomeTemplates) {
        if (!(first ? t.applies_first_fortnight : t.applies_second_fortnight)) continue;
        const amount = num(t.suggested_amount);
        if (amount <= 0) continue;
        baseline.push({ date: endYmd, amount, kind: 'income', name: t.name, walletName: 'Ingreso programado', estimated: true });
      }
    }

    // Budgets, like Panel's "presupuesto restante": from today on, prorated by day.
    const from = startYmd > todayYmd ? startYmd : todayYmd;
    if (from > endYmd) continue;
    for (const b of budgets) {
      const bStart = b.start_date ? formatCalendarDate(b.start_date) : '0000-01-01';
      const bEnd = b.end_date && !b.recurrent ? formatCalendarDate(b.end_date) : '9999-12-31';
      const days = overlapDays(from, endYmd, bStart, bEnd);
      if (days <= 0) continue;
      const total = num(b.total_amount);
      let amount = 0;
      if (b.frequency === 'DAILY') amount = total * days;
      else if (b.frequency === 'WEEKLY') amount = (total * days) / 7;
      else if (b.frequency === 'BIWEEKLY') {
        amount = total * (days / overlapDays(startYmd, endYmd, startYmd, endYmd));
      } else if (b.start_date && b.end_date) {
        const span = overlapDays(bStart, formatCalendarDate(b.end_date), bStart, formatCalendarDate(b.end_date));
        amount = span > 0 ? (total * days) / span : 0;
      }
      if (amount > 0) {
        baseline.push({ date: endYmd, amount: cents(amount), kind: 'budget', name: b.name, walletName: 'Presupuesto', estimated: !createdKeys.has(key) });
      }
    }
  }

  // Habitual card consumption: cycles the projection could not resolve get the
  // average of the card's resolved statements (first three), flagged as estimate.
  const consumption: Loaded['consumption'] = [];
  const cards: CardDebtInput[] = [];
  for (const card of wallets.filter((w) => w.isCard)) {
    const resolved = (statementByCard.get(card.id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const sample = resolved.filter((r) => r.amount > 0).slice(0, 3);
    const avg = sample.length > 0 ? cents(sample.reduce((s, r) => s + r.amount, 0) / sample.length) : 0;
    let floor: CardDebtInput['consumptionFloor'] = null;
    if (avg > 0 && card.cutoffDay != null && card.dueDay != null) {
      const resolvedDates = new Set(resolved.map((r) => r.date));
      for (let i = 0; i < 400; i++) {
        const charge = addMonthsYmd(todayYmd, i, card.cutoffDay);
        const due = cardStatementForCharge(charge, card.cutoffDay, card.dueDay).dueDate;
        if (due > untilYmd) break;
        if (due < todayYmd || resolvedDates.has(due)) continue;
        baseline.push({ date: due, amount: avg, kind: 'consumption', name: `Consumo habitual ${card.name}`, walletName: card.name, estimated: true });
        if (!floor) floor = { fromDate: due, amount: avg };
      }
      consumption.push({ walletId: card.id, name: card.name, amount: avg });
    }
    cards.push({
      id: card.id,
      name: card.name,
      providerIconKey: card.providerIconKey,
      limit: card.limit,
      debtToday: card.debt ?? 0,
      statementPayments: resolved,
      consumptionFloor: floor,
    });
  }

  const loansById = new Map<number, LoanDebtInput>();
  for (const p of loanPayments) {
    const entry = loansById.get(p.loan.id) ?? { id: p.loan.id, name: p.loan.name, payments: [] };
    entry.payments.push({ date: formatCalendarDate(p.due_date), amount: num(p.amount) });
    loansById.set(p.loan.id, entry);
  }

  return {
    todayYmd,
    untilYmd,
    startingLiquidity: cents(projection.funding_wallets.reduce((s, w) => s + w.balance, 0)),
    baseline,
    createdKeys,
    lastCreatedKey,
    cards,
    loans: [...loansById.values()],
    consumption,
  };
};

export const loadSimulationWallets = async (ownerFilter: OwnerFilter): Promise<SimulationWallet[]> => {
  const rows = await prisma.wallet.findMany({
    where: { ...ownerFilter, active: true },
    select: {
      id: true, name: true, type: true, provider_icon_key: true, amount: true, credit_limit: true,
      temporary_credit_limit: true, cutoff_day: true, due_day: true, apr_annual: true, include_in_liquidity: true,
    },
    orderBy: { id: 'asc' },
  });
  return rows
    .filter((w) => !isFundingWalletType(w.type) || w.include_in_liquidity)
    .map((w) => {
      const isCard = !isFundingWalletType(w.type);
      const limit = isCard ? num(w.temporary_credit_limit ?? w.credit_limit) || null : null;
      const debt = isCard ? num(w.amount) : null;
      return {
        id: w.id,
        name: w.name,
        type: w.type,
        isCard,
        providerIconKey: w.provider_icon_key,
        balance: isCard ? null : num(w.amount),
        debt,
        limit,
        available: limit != null && debt != null ? cents(limit - debt) : null,
        cutoffDay: w.cutoff_day,
        dueDay: w.due_day,
        aprAnnualPct: w.apr_annual != null ? cents(num(w.apr_annual) * 100) : null,
      };
    });
};

const planWallet = (w: SimulationWallet): PlanWallet => ({
  id: w.id,
  name: w.name,
  isCard: w.isCard,
  cutoff_day: w.cutoffDay,
  due_day: w.dueDay,
});

const toPlanInput = (input: PurchaseSimulationInput, wallets: Map<number, SimulationWallet>): PurchasePlanInput => {
  const need = (id: number | undefined, field: string) => {
    const w = id != null ? wallets.get(id) : undefined;
    if (!w) throw new PurchaseSimulationError('Elige una billetera de este espacio.', field, 404);
    return w;
  };
  const lender = input.lender ?? 'new';
  const main =
    input.mode === 'credito' && lender === 'new'
      ? need(input.pay_wallet_id, 'pay_wallet_id')
      : need(input.wallet_id, 'wallet_id');
  const down = input.down_wallet_id != null ? need(input.down_wallet_id, 'down_wallet_id') : null;
  const pay = input.pay_wallet_id != null ? need(input.pay_wallet_id, 'pay_wallet_id') : null;
  return {
    total: input.total,
    date: input.date,
    mode: input.mode,
    wallet: planWallet(main),
    months: input.months,
    lender,
    annualRatePct: input.annual_rate ?? (lender === 'card' ? (main.aprAnnualPct ?? undefined) : undefined),
    monthlyPayment: input.monthly_payment,
    downPayment: input.down_payment,
    downWallet: down ? { id: down.id, name: down.name } : null,
    payWallet: pay ? { id: pay.id, name: pay.name } : null,
    paymentDay: input.payment_day,
    extraMonthly: input.extra_monthly,
  };
};

const overLimit = (plan: PurchasePlan, wallets: Map<number, SimulationWallet>): number => {
  if (typeof plan.debtWalletId !== 'number') return 0;
  const w = wallets.get(plan.debtWalletId);
  if (!w || w.available == null) return 0;
  return Math.max(0, cents(plan.principal - w.available));
};

const alternativePatches = (
  input: PurchaseSimulationInput,
  wallets: SimulationWallet[],
): { id: string; label: string; patch: Partial<PurchaseSimulationInput> }[] => {
  const cards = wallets.filter((w) => w.isCard && w.cutoffDay != null && w.dueDay != null);
  const funding = wallets.filter((w) => !w.isCard);
  if (input.mode === 'credito' && (input.lender ?? 'new') === 'new') {
    return [24, 36, 48, 60, 72].map((m) => ({ id: `credit-${m}`, label: `Crédito a ${m} meses`, patch: { months: m } }));
  }
  if (input.mode === 'credito') {
    return [6, 12, 18, 24].map((m) => ({ id: `card-int-${m}`, label: `${m} meses con intereses`, patch: { months: m } }));
  }
  const current = input.wallet_id != null ? wallets.find((w) => w.id === input.wallet_id) : undefined;
  const card = current?.isCard ? current : cards[0];
  const out: { id: string; label: string; patch: Partial<PurchaseSimulationInput> }[] = [];
  const richest = [...funding].sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))[0];
  if (richest) out.push({ id: `contado-${richest.id}`, label: `De contado · ${richest.name}`, patch: { mode: 'contado', wallet_id: richest.id } });
  if (card) {
    out.push({ id: `contado-${card.id}`, label: `De contado · ${card.name}`, patch: { mode: 'contado', wallet_id: card.id } });
    for (const m of [3, 6, 12, 18] as const) {
      out.push({ id: `msi-${card.id}-${m}`, label: `${m} MSI · ${card.name}`, patch: { mode: 'msi', wallet_id: card.id, months: m } });
    }
    const months = input.mode === 'msi' && input.months ? input.months : 12;
    for (const other of cards.filter((c) => c.id !== card.id).slice(0, 2)) {
      out.push({ id: `msi-${other.id}-${months}`, label: `${months} MSI · ${other.name}`, patch: { mode: 'msi', wallet_id: other.id, months } });
    }
  }
  return out.filter((a) => a.patch.mode !== 'msi' || (MSI_MONTH_OPTIONS as readonly number[]).includes(a.patch.months!));
};

const isCurrent = (input: PurchaseSimulationInput, patch: Partial<PurchaseSimulationInput>) =>
  (Object.keys(patch) as (keyof PurchaseSimulationInput)[]).every((k) => input[k] === patch[k]);

export const ASSUMPTIONS_ES = [
  'Cada quincena se calcula como en tu Panel: lo que entra menos lo que ya tienes que pagar y tus presupuestos.',
  'La quincena de hoy cuenta solo lo que falta desde hoy; tu dinero de hoy ya incluye lo que pasó.',
  'Donde aún no creas la quincena, usamos tus ingresos y gastos programados: los gastos sueltos que no registras no aparecen.',
  'Tus tarjetas: pagas el total de cada estado de cuenta. Donde no hay estado proyectado, sumamos tu consumo habitual (promedio de tus estados recientes).',
  'No incluye cambios de sueldo, el pago mínimo de las tarjetas ni gastos que aún no registras.',
  'No se guarda nada y nadie recibe aviso. Es lo que pasaría, no una recomendación ni asesoría financiera.',
];

export async function simulatePurchase(params: {
  ownerFilter: OwnerFilter;
  input: PurchaseSimulationInput;
  asOf?: Date;
}): Promise<PurchaseSimulationResult> {
  const asOf = params.asOf ?? new Date();
  const todayYmd = formatCalendarDate(asOf);
  const { input } = params;
  if (input.date < todayYmd) {
    throw new PurchaseSimulationError('Elige un día de hoy en adelante.', 'date');
  }

  const wallets = await loadSimulationWallets(params.ownerFilter);
  const byId = new Map(wallets.map((w) => [w.id, w]));

  const plan = (() => {
    try {
      return buildPurchasePlan(toPlanInput(input, byId));
    } catch (error) {
      if (error instanceof PurchasePlanError) throw new PurchaseSimulationError(error.message, error.field);
      throw error;
    }
  })();

  const name = input.name?.trim() || 'tu compra';
  const untilYmd = input.horizon_months
    ? addMonthsYmd(todayYmd, input.horizon_months)
    : defaultHorizonEnd(plan);

  // The alternatives may end later than the chosen plan; load the baseline once for the longest.
  const altDefs = alternativePatches(input, wallets);
  const altPlans = altDefs.flatMap((a) => {
    try {
      return [{ ...a, plan: buildPurchasePlan(toPlanInput({ ...input, ...a.patch, monthly_payment: a.patch.months ? undefined : input.monthly_payment }, byId)) }];
    } catch {
      return [];
    }
  });
  const loadUntil = input.horizon_months
    ? untilYmd
    : [untilYmd, ...altPlans.map((a) => defaultHorizonEnd(a.plan))].sort().at(-1)!;

  const loaded = await loadBaseline(params.ownerFilter, wallets, todayYmd, loadUntil, asOf);
  const withinUntil = (until: string) => loaded.baseline.filter((f) => f.date <= until);

  const series = buildQuincenaSeries({
    todayYmd,
    untilYmd,
    startingLiquidity: loaded.startingLiquidity,
    baseline: withinUntil(untilYmd),
    purchase: purchaseFlows(plan, name, untilYmd),
    createdKeys: loaded.createdKeys,
  });
  const verdict = verdictFacts(series, overLimit(plan, byId));

  const alternatives: SimulationAlternative[] = altPlans.map((a) => {
    const until = input.horizon_months ? untilYmd : defaultHorizonEnd(a.plan);
    const altSeries = buildQuincenaSeries({
      todayYmd,
      untilYmd: until,
      startingLiquidity: loaded.startingLiquidity,
      baseline: withinUntil(until),
      purchase: purchaseFlows(a.plan, name, until),
      createdKeys: loaded.createdKeys,
    });
    const facts = verdictFacts(altSeries, overLimit(a.plan, byId));
    return {
      id: a.id,
      label: a.label,
      patch: a.patch,
      current: isCurrent(input, a.patch),
      level: facts.level,
      redCount: facts.redKeys.length,
      quincenas: facts.quincenas,
      tightestQueda: facts.tightestQueda,
      regularPayment: a.plan.regularPayment,
      count: a.plan.count,
      interest: a.plan.interest,
      lastDueDate: a.plan.lastDueDate,
    };
  });

  const debt = buildDebtSeries({
    todayYmd,
    untilYmd,
    cards: loaded.cards,
    loans: loaded.loans,
    plan,
    purchaseName: name,
  });

  return {
    as_of: todayYmd,
    until: untilYmd,
    starting_liquidity: loaded.startingLiquidity,
    last_created_quincena: loaded.lastCreatedKey,
    wallets,
    plan,
    series,
    verdict,
    debt,
    alternatives,
    assumptions: [...ASSUMPTIONS_ES],
    card_consumption: loaded.consumption,
  };
}
