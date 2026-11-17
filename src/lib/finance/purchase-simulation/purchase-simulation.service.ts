import prisma from '@/lib/prisma';
import { formatCalendarDate, parseCalendarDate } from '@/lib/calendar-dates';
import { getLiquidityProjection } from '@/lib/finance/liquidity-projection.service';
import { cardStatementForCharge } from '@/lib/finance/card-statement-cycle';
import { isFundingWalletType } from '@/lib/finance/wallet-accounting';
import { getCalendarFortnightRefForYmd, getFortnightYmdBounds, type CalendarFortnightRef } from '@/lib/fortnight-calendar';
import { getReportSummary } from '@/lib/finance/report-summary.service';
import { listPlanningTransactions } from '@/lib/finance/planning-transactions.service';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import { addMonthsYmd } from '@/lib/finance/purchase-simulation/plan';
import {
  listQuincenas,
  quincenaKey,
  type BaselineFlow,
  type FlowKind,
} from '@/lib/finance/purchase-simulation/series';
import type { SimulationBaseline, SimulationWallet } from '@/lib/finance/purchase-simulation/simulate';
import { applyFortnightAdjustment, type FortnightAdjustmentInput } from '@/lib/finance/budget-fortnight-effective';

/**
 * GET /api/wallets/purchase-simulation (MIC-I17): the server half of Simular
 * compra: loads the owner's wallets and, once, everything that already happens
 * without the purchase: Panel's own figures for created quincenas, the
 * projection (card statements, loans) and programmed income and expenses for
 * the rest, budgets and habitual card consumption. The browser adds the
 * purchase (simulate.ts). Read-only.
 */

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const cents = (n: number) => Math.round(n * 100) / 100;

/** Days of [start, end] inside [from, to], inclusive. */
const overlapDays = (start: string, end: string, from: string, to: string): number => {
  const a = start > from ? start : from;
  const b = end < to ? end : to;
  if (a > b) return 0;
  return Math.round((parseCalendarDate(b).getTime() - parseCalendarDate(a).getTime()) / 86_400_000) + 1;
};

/**
 * One created quincena as Panel computes it: incomes recorded in it (today's
 * leaves out the ones already credited to a wallet, which today's balance
 * already holds), unpaid planning rows (gastos, pending card dues, wallet loan
 * cuotas; cuotas a meses excluded) and payroll deductions.
 */
const panelQuincenas = async (
  ownerFilter: OwnerFilter,
  refs: CalendarFortnightRef[],
  idByKey: Map<string, number>,
  todayYmd: string,
  currentKey: string,
): Promise<BaselineFlow[]> => {
  const out: BaselineFlow[] = [];
  for (let i = 0; i < refs.length; i += 4) {
    const batch = refs.slice(i, i + 4);
    const results = await Promise.all(
      batch.map(async (ref) => {
        const key = quincenaKey(ref);
        const id = idByKey.get(key)!;
        const params = {
          ownerFilter,
          year: String(ref.year),
          month: String(ref.month),
          period: ref.period,
          excludeCreditInstallment: true,
          resolvedFortnightIds: [id],
        };
        const [summary, rows, credited] = await Promise.all([
          getReportSummary(params),
          listPlanningTransactions({ ...params, type: 'expense' }),
          key === currentKey
            ? prisma.income.findMany({ where: { ...ownerFilter, fortnight_id: id, wallet_credited: true }, select: { id: true } })
            : Promise.resolve([] as { id: number }[]),
        ]);
        return { ref, key, summary, rows, creditedIds: new Set(credited.map((c) => c.id)) };
      }),
    );
    for (const { ref, summary, rows, creditedIds } of results) {
      const { startYmd, endYmd } = getFortnightYmdBounds(ref.year, ref.month, ref.period);
      const at = (ymd: string | null | undefined) => {
        const d = ymd && ymd >= startYmd && ymd <= endYmd ? ymd : endYmd;
        return d < todayYmd ? todayYmd : d;
      };
      for (const inc of summary.incomeItems) {
        if (creditedIds.has(inc.id) || !(inc.amount > 0)) continue;
        out.push({ date: endYmd < todayYmd ? todayYmd : endYmd, amount: inc.amount, kind: 'income', name: inc.templateName ?? inc.source ?? 'Ingreso', walletName: 'Ingreso', estimated: false });
      }
      for (const row of rows) {
        const amount = num(row.amount);
        if (row.is_paid || !(amount > 0)) continue;
        // Like Panel: a charge on a card reaches cash through the card's payment (its own row).
        const onCard = row.wallet_type === 'CREDIT_CARD' || row.wallet_type === 'DEPARTMENT_STORE_CARD';
        if (onCard && (row.planning_row_kind ?? 'expense') === 'expense') continue;
        // Payroll loan cuotas come out of the sueldo: counted once, as Panel's payroll deduction below.
        if (row.loan_payment_source === 'PAYROLL_DEDUCTION') continue;
        const kind: FlowKind = row.planning_row_kind === 'card_payment' ? 'card' : row.planning_row_kind === 'loan_payment' ? 'loan' : 'expense';
        out.push({ date: at(row.date), amount, kind, name: row.description, walletName: row.paymentMethod, estimated: false });
      }
      const payroll = summary.planningPayrollLoanDeduction?.total ?? 0;
      if (payroll > 0) {
        out.push({ date: at(endYmd), amount: payroll, kind: 'loan', name: 'Deducciones de nómina', walletName: 'Nómina', estimated: false });
      }
    }
  }
  return out;
};

export const loadSimulationBaseline = async (
  ownerFilter: OwnerFilter,
  wallets: SimulationWallet[],
  untilYmd: string,
  asOf: Date = new Date(),
): Promise<SimulationBaseline> => {
  const todayYmd = formatCalendarDate(asOf);
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
  const projected: BaselineFlow[] = [];
  for (const milestone of projection.milestones) {
    for (const o of milestone.obligations) {
      const date = milestone.due_date;
      const amount = o.next_due_payment;
      if (o.source === 'credit_card_statement') {
        const list = statementByCard.get(o.wallet_id) ?? [];
        list.push({ date, amount });
        statementByCard.set(o.wallet_id, list);
        projected.push({ date, amount, kind: 'card', name: `Pago ${o.wallet_name}`, walletName: o.wallet_name, estimated: true });
      } else if (o.source === 'loan_payment') {
        projected.push({ date, amount, kind: 'loan', name: o.loan_name ?? 'Préstamo', walletName: o.wallet_name, estimated: true });
      }
    }
  }

  const refs = listQuincenas(todayYmd, untilYmd);
  const [fortnights, expenseTemplates, incomeTemplates, budgets] = await Promise.all([
    prisma.fortnight.findMany({
      where: { ...ownerFilter },
      select: { id: true, year: true, month: true, period: true },
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
      select: {
        id: true,
        name: true,
        total_amount: true,
        frequency: true,
        start_date: true,
        end_date: true,
        recurrent: true,
        allocations: { select: { wallet_id: true, category_id: true, amount: true } },
      },
    }),
  ]);
  const adjustments = await loadQuincenaAdjustments(ownerFilter);

  const createdKeys = new Set(
    fortnights.map((f) => quincenaKey({ year: f.year, month: f.month, period: f.period })),
  );

  // Projection lines only where no quincena exists yet: Panel's own numbers cover the created ones.
  const firstKey = quincenaKey(refs[0]);
  const keyOf = (date: string) => (date < todayYmd ? firstKey : quincenaKey(getCalendarFortnightRefForYmd(date)));
  for (const flow of projected) if (!createdKeys.has(keyOf(flow.date))) baseline.push(flow);

  // Created quincenas: the same figures Panel shows (incomes, pending expenses, card and loan dues).
  const fortnightIdByKey = new Map(
    fortnights.map((f) => [quincenaKey({ year: f.year, month: f.month, period: f.period }), f.id]),
  );
  const createdInRange = refs.filter((r) => createdKeys.has(quincenaKey(r)));
  const panelRows = await panelQuincenas(ownerFilter, createdInRange, fortnightIdByKey, todayYmd, firstKey);
  baseline.push(...panelRows);

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
      const share = (overlap: number) => {
        if (b.frequency === 'DAILY') return total * overlap;
        if (b.frequency === 'WEEKLY') return (total * overlap) / 7;
        if (b.frequency === 'BIWEEKLY') return total * (overlap / overlapDays(startYmd, endYmd, startYmd, endYmd));
        if (b.start_date && b.end_date) {
          const span = overlapDays(bStart, formatCalendarDate(b.end_date), bStart, formatCalendarDate(b.end_date));
          return span > 0 ? (total * overlap) / span : 0;
        }
        return 0;
      };
      let amount = share(days);
      // One-quincena adjustment (MIC-I19): same resolver as Panel, prorated from today like the template.
      const adjustment = adjustments.get(`${b.id}:${key}`);
      if (adjustment) {
        const full = share(overlapDays(startYmd, endYmd, bStart, bEnd));
        const scale = total > 0 ? full / total : 0;
        const adjusted = applyFortnightAdjustment(
          b.allocations.map((a) => ({ wallet_id: a.wallet_id, category_id: a.category_id, budgeted: num(a.amount) * scale })),
          adjustment,
        ).reduce((sum, value) => sum + value, 0);
        amount = full > 0 ? (adjusted * amount) / full : 0;
      }
      if (amount > 0) {
        baseline.push({ date: endYmd, amount: cents(amount), kind: 'budget', name: b.name, walletName: 'Presupuesto', estimated: !createdKeys.has(key) });
      }
    }
  }

  // Habitual card consumption: cycles the projection could not resolve get the
  // average of the card's resolved statements (first three), flagged as estimate.
  const consumption: SimulationBaseline['card_consumption'] = [];
  for (const card of wallets.filter((w) => w.isCard)) {
    const resolved = (statementByCard.get(card.id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const sample = resolved.filter((r) => r.amount > 0).slice(0, 3);
    const avg = sample.length > 0 ? cents(sample.reduce((s, r) => s + r.amount, 0) / sample.length) : 0;
    if (avg > 0 && card.cutoffDay != null && card.dueDay != null) {
      const resolvedDates = new Set(resolved.map((r) => r.date));
      for (let i = 0; i < 400; i++) {
        const charge = addMonthsYmd(todayYmd, i, card.cutoffDay);
        const due = cardStatementForCharge(charge, card.cutoffDay, card.dueDay).dueDate;
        if (due > untilYmd) break;
        if (due < todayYmd || resolvedDates.has(due) || createdKeys.has(keyOf(due))) continue;
        baseline.push({ date: due, amount: avg, kind: 'consumption', name: `Consumo habitual ${card.name}`, walletName: card.name, estimated: true });
      }
      consumption.push({ walletId: card.id, name: card.name, amount: avg });
    }
  }

  return {
    as_of: todayYmd,
    until: untilYmd,
    flows: baseline,
    created_keys: [...createdKeys],
    card_consumption: consumption,
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

/** One-quincena budget adjustments by `${budgetId}:${quincenaKey}`. */
async function loadQuincenaAdjustments(
  ownerFilter: OwnerFilter,
): Promise<Map<string, FortnightAdjustmentInput>> {
  const out = new Map<string, FortnightAdjustmentInput>();
  const model = (prisma as { budgetFortnightAdjustment?: { findMany?: unknown } }).budgetFortnightAdjustment;
  if (!model || typeof model.findMany !== 'function') return out;
  const rows = await prisma.budgetFortnightAdjustment.findMany({
    where: { ...ownerFilter },
    select: {
      budget_id: true,
      year: true,
      month: true,
      period: true,
      kind: true,
      allocations: { select: { wallet_id: true, category_id: true, amount: true } },
    },
  });
  for (const row of rows) {
    out.set(`${row.budget_id}:${quincenaKey({ year: row.year, month: row.month, period: row.period })}`, {
      kind: row.kind,
      allocations: row.allocations.map((a) => ({ wallet_id: a.wallet_id, category_id: a.category_id, amount: Number(a.amount) })),
    });
  }
  return out;
}
