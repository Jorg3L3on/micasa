import { addMonthsYmd, buildPurchasePlan, PurchasePlanError, type PlanWallet, type PurchasePlan, type PurchasePlanInput } from '@/lib/finance/purchase-simulation/plan';
import {
  buildQuincenaSeries,
  defaultHorizonEnd,
  purchaseFlows,
  verdictFacts,
  type BaselineFlow,
  type QuincenaRow,
  type VerdictFacts,
} from '@/lib/finance/purchase-simulation/series';
import { getCalendarFortnightRefForYmd, getFortnightYmdBounds } from '@/lib/fortnight-calendar';
import { purchaseSimulationSchema, type PurchaseSimulationInput } from '@/schemas/purchase-simulation.schema';

/**
 * Simular compra (MIC-I17), the part that runs in the browser. The server
 * sends the quincenas once (GET /api/wallets/purchase-simulation); every change
 * of price, card or months is computed here, with no request. Pure.
 */

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

/** What already happens without the purchase, from today through `until`. */
export type SimulationBaseline = {
  as_of: string;
  until: string;
  flows: BaselineFlow[];
  /** quincenaKey of every quincena that has a Fortnight row. */
  created_keys: string[];
  card_consumption: { walletId: number; name: string; amount: number }[];
};

export type PurchaseSimulationResult = {
  as_of: string;
  until: string;
  wallets: SimulationWallet[];
  plan: PurchasePlan;
  series: QuincenaRow[];
  verdict: VerdictFacts;
  assumptions: string[];
  card_consumption: SimulationBaseline['card_consumption'];
};

/** A form value the simulation cannot use, pinned to its field. */
export class SimulationInputError extends Error {
  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message);
    this.name = 'SimulationInputError';
  }
}

export const ASSUMPTIONS_ES = [
  'Cada quincena, como en tu Panel: lo que entra menos lo que tienes que pagar y tus presupuestos. La de hoy cuenta solo lo que falta.',
  'Tarjetas: pagas el total de cada estado de cuenta; donde no hay estado, tu consumo habitual.',
  'No incluye cambios de sueldo ni pagos mínimos. No se guarda nada.',
];

/** Months the first load covers: a 24 MSI purchase made today fits. */
const BASELINE_DEFAULT_MONTHS = 27;

const endOfQuincena = (ymd: string) => {
  const ref = getCalendarFortnightRefForYmd(ymd);
  return getFortnightYmdBounds(ref.year, ref.month, ref.period).endYmd;
};

/** Until of the first load. */
export const defaultBaselineUntil = (todayYmd: string) =>
  endOfQuincena(addMonthsYmd(todayYmd, BASELINE_DEFAULT_MONTHS, 1));

/** Until to ask for when a plan ends after the loaded quincenas: the last quincena of that year. */
export const extendedBaselineUntil = (neededYmd: string) => {
  const year = Number(neededYmd.slice(0, 4));
  const yearEnd = endOfQuincena(`${year}-12-15`);
  // 31 de diciembre already belongs to next year's 1ª de enero.
  return yearEnd >= neededYmd ? yearEnd : endOfQuincena(`${year + 1}-12-15`);
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
    if (!w) throw new SimulationInputError('Elige una billetera de este espacio.', field);
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

/** Pesos the purchase is over the card's disponible (0 when it fits or there is no card). */
export const overLimitBy = (plan: PurchasePlan, wallets: SimulationWallet[]): number => {
  if (typeof plan.debtWalletId !== 'number') return 0;
  const w = wallets.find((x) => x.id === plan.debtWalletId);
  if (!w || w.available == null) return 0;
  return Math.max(0, Math.round((plan.principal - w.available) * 100) / 100);
};

export type PreparedPurchase = { input: PurchaseSimulationInput; plan: PurchasePlan; until: string };

/** Validates the form values and turns them into dated payments. Throws SimulationInputError. */
export function preparePurchase(body: unknown, wallets: SimulationWallet[], todayYmd: string): PreparedPurchase {
  const parsed = purchaseSimulationSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new SimulationInputError(first?.message ?? 'Revisa los datos.', typeof first?.path[0] === 'string' ? first.path[0] : 'total');
  }
  const input = parsed.data;
  if (input.date < todayYmd) throw new SimulationInputError('Elige un día de hoy en adelante.', 'date');
  try {
    const plan = buildPurchasePlan(toPlanInput(input, new Map(wallets.map((w) => [w.id, w]))));
    // Always until the quincena of the last payment.
    return { input, plan, until: defaultHorizonEnd(plan) };
  } catch (error) {
    if (error instanceof PurchasePlanError) throw new SimulationInputError(error.message, error.field);
    throw error;
  }
}

/** The quincena series with and without the purchase, and the facts behind the verdict. */
export function simulatePurchase(
  prepared: PreparedPurchase,
  wallets: SimulationWallet[],
  baseline: SimulationBaseline,
): PurchaseSimulationResult {
  const { input, plan, until } = prepared;
  if (until > baseline.until) throw new Error('The loaded quincenas end before the purchase does.');
  const name = input.name?.trim() || 'tu compra';
  const series = buildQuincenaSeries({
    todayYmd: baseline.as_of,
    untilYmd: until,
    baseline: baseline.flows,
    purchase: purchaseFlows(plan, name, until),
    createdKeys: new Set(baseline.created_keys),
  });
  return {
    as_of: baseline.as_of,
    until,
    wallets,
    plan,
    series,
    verdict: verdictFacts(series, overLimitBy(plan, wallets)),
    assumptions: [...ASSUMPTIONS_ES],
    card_consumption: baseline.card_consumption,
  };
}
