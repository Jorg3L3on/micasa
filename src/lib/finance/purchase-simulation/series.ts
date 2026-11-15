import {
  getCalendarFortnightRefForYmd,
  getFortnightYmdBounds,
  shiftCalendarMonth,
  type CalendarFortnightRef,
} from '@/lib/fortnight-calendar';
import type { PurchasePlan } from '@/lib/finance/purchase-simulation/plan';
import { addMonthsYmd } from '@/lib/finance/purchase-simulation/plan';

/**
 * Purchase simulation, step 2 (MIC-I17-2): bucket dated money into quincenas
 * and compare "con la compra" against "sin la compra". Pure.
 */

export type FlowKind =
  | 'income'
  | 'expense'
  | 'template'
  | 'card'
  | 'consumption'
  | 'loan'
  | 'budget';

/** One dated movement of the baseline (what already happens without the purchase). */
export type BaselineFlow = {
  date: string;
  /** Positive pesos. Incomes add, everything else subtracts. */
  amount: number;
  kind: FlowKind;
  name: string;
  walletName: string;
  estimated: boolean;
};

export type FlowLine = {
  name: string;
  amount: number;
  date: string;
  walletName: string;
  kind: FlowKind | 'purchase';
  estimated: boolean;
  onCard?: boolean;
};

export type QuincenaRow = {
  key: string;
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
  startYmd: string;
  endYmd: string;
  /** No Fortnight row exists: income and programmed expenses are estimated. */
  estimated: boolean;
  entra: number;
  comprometido: number;
  compra: number;
  /** entra − comprometido, without the purchase. */
  sinCompra: number;
  /** entra − comprometido − compra. */
  queda: number;
  acumulado: number;
  acumuladoSinCompra: number;
  incomes: FlowLine[];
  outflows: FlowLine[];
  purchase: FlowLine[];
};

export type VerdictLevel = 'green' | 'amber' | 'red';

export type VerdictFacts = {
  level: VerdictLevel;
  quincenas: number;
  redKeys: string[];
  /** Red only because of the purchase. */
  newRedKeys: string[];
  baselineRedCount: number;
  tightestKey: string;
  tightestQueda: number;
  tightestSinCompra: number;
  baselineTightest: number;
  lowestAcumulado: number;
  lowestAcumuladoKey: string;
  firstNegativeAcumuladoKey: string | null;
  /** Quincenas with money left but less than 10% of what comes in, where the purchase pays. */
  justaKeys: string[];
  overLimitBy: number;
};

export const JUSTA_THRESHOLD = 0.1;

const cents = (n: number) => Math.round(n * 100) / 100;

export const quincenaKey = (ref: CalendarFortnightRef): string =>
  `${ref.year}-${String(ref.month).padStart(2, '0')}-${ref.period === 'FIRST' ? 1 : 2}`;

export const nextQuincena = (ref: CalendarFortnightRef): CalendarFortnightRef =>
  ref.period === 'FIRST'
    ? { ...ref, period: 'SECOND' }
    : { ...shiftCalendarMonth(ref.year, ref.month, 1), period: 'FIRST' };

/** Quincenas from the one containing `fromYmd` through the one containing `toYmd`. */
export const listQuincenas = (fromYmd: string, toYmd: string): CalendarFortnightRef[] => {
  const out: CalendarFortnightRef[] = [];
  let ref = getCalendarFortnightRefForYmd(fromYmd);
  const lastKey = quincenaKey(getCalendarFortnightRefForYmd(toYmd));
  for (let guard = 0; guard < 2000; guard++) {
    out.push(ref);
    if (quincenaKey(ref) === lastKey) break;
    ref = nextQuincena(ref);
  }
  return out;
};

/** The simulation ends with the quincena of the last payment (Jorge, 2026-11-15). */
export const defaultHorizonEnd = (plan: PurchasePlan): string => {
  const ref = getCalendarFortnightRefForYmd(plan.lastDueDate);
  return getFortnightYmdBounds(ref.year, ref.month, ref.period).endYmd;
};

/** Cash lines the purchase adds (enganche, cuotas, mensualidades, running cost). */
export const purchaseFlows = (plan: PurchasePlan, name: string, untilYmd: string): FlowLine[] => {
  const lines: FlowLine[] = plan.payments.map((p) => ({
    name: `${p.label} · ${name}`,
    amount: p.amount,
    date: p.date,
    walletName: p.walletName,
    kind: 'purchase' as const,
    estimated: false,
    onCard: p.onCard,
  }));
  if (plan.extraMonthly) {
    for (let i = 0; ; i++) {
      const date = addMonthsYmd(plan.extraMonthly.fromDate, i, plan.extraMonthly.day);
      if (date > untilYmd) break;
      lines.push({
        name: `Gasto extra al mes · ${name}`,
        amount: plan.extraMonthly.amount,
        date,
        walletName: 'Estimado',
        kind: 'purchase',
        estimated: true,
      });
    }
  }
  return lines;
};

export type BuildSeriesInput = {
  todayYmd: string;
  untilYmd: string;
  startingLiquidity: number;
  baseline: BaselineFlow[];
  purchase: FlowLine[];
  /** Keys (quincenaKey) of quincenas that have a Fortnight row. */
  createdKeys: Set<string>;
};

export function buildQuincenaSeries(input: BuildSeriesInput): QuincenaRow[] {
  const refs = listQuincenas(input.todayYmd, input.untilYmd);
  const rows = new Map<string, QuincenaRow>();
  for (const ref of refs) {
    const bounds = getFortnightYmdBounds(ref.year, ref.month, ref.period);
    const key = quincenaKey(ref);
    rows.set(key, {
      key,
      year: ref.year,
      month: ref.month,
      period: ref.period,
      startYmd: bounds.startYmd,
      endYmd: bounds.endYmd,
      estimated: !input.createdKeys.has(key),
      entra: 0,
      comprometido: 0,
      compra: 0,
      sinCompra: 0,
      queda: 0,
      acumulado: 0,
      acumuladoSinCompra: 0,
      incomes: [],
      outflows: [],
      purchase: [],
    });
  }
  const firstKey = quincenaKey(refs[0]);
  const rowFor = (date: string) => {
    // Past-due items belong to the current quincena.
    if (date < input.todayYmd) return rows.get(firstKey)!;
    return rows.get(quincenaKey(getCalendarFortnightRefForYmd(date)));
  };

  for (const flow of input.baseline) {
    if (flow.amount <= 0 || flow.date > input.untilYmd) continue;
    const row = rowFor(flow.date);
    if (!row) continue;
    const line: FlowLine = {
      name: flow.name,
      amount: cents(flow.amount),
      date: flow.date,
      walletName: flow.walletName,
      kind: flow.kind,
      estimated: flow.estimated,
    };
    if (flow.kind === 'income') {
      row.entra += line.amount;
      row.incomes.push(line);
    } else {
      row.comprometido += line.amount;
      row.outflows.push(line);
    }
  }
  for (const line of input.purchase) {
    if (line.amount <= 0 || line.date > input.untilYmd) continue;
    const row = rowFor(line.date);
    if (!row) continue;
    row.compra += line.amount;
    row.purchase.push(line);
  }

  let acc = input.startingLiquidity;
  let accBase = input.startingLiquidity;
  const out: QuincenaRow[] = [];
  for (const ref of refs) {
    const row = rows.get(quincenaKey(ref))!;
    row.entra = cents(row.entra);
    row.comprometido = cents(row.comprometido);
    row.compra = cents(row.compra);
    row.sinCompra = cents(row.entra - row.comprometido);
    row.queda = cents(row.sinCompra - row.compra);
    acc = cents(acc + row.queda);
    accBase = cents(accBase + row.sinCompra);
    row.acumulado = acc;
    row.acumuladoSinCompra = accBase;
    row.outflows.sort((a, b) => b.amount - a.amount);
    row.incomes.sort((a, b) => b.amount - a.amount);
    row.purchase.sort((a, b) => a.date.localeCompare(b.date));
    out.push(row);
  }
  return out;
}

export function verdictFacts(rows: QuincenaRow[], overLimitBy: number): VerdictFacts {
  const red = rows.filter((r) => r.queda < 0);
  let tight = rows[0];
  let low = rows[0];
  let baselineTightest = rows[0].sinCompra;
  for (const r of rows) {
    if (r.queda < tight.queda) tight = r;
    if (r.acumulado < low.acumulado) low = r;
    if (r.sinCompra < baselineTightest) baselineTightest = r.sinCompra;
  }
  const firstNeg = rows.find((r) => r.acumulado < 0) ?? null;
  const level: VerdictLevel =
    overLimitBy > 0 || firstNeg ? 'red' : red.length > 0 ? 'amber' : 'green';
  return {
    level,
    quincenas: rows.length,
    redKeys: red.map((r) => r.key),
    newRedKeys: red.filter((r) => r.sinCompra >= 0).map((r) => r.key),
    baselineRedCount: rows.filter((r) => r.sinCompra < 0).length,
    tightestKey: tight.key,
    tightestQueda: tight.queda,
    tightestSinCompra: tight.sinCompra,
    baselineTightest,
    lowestAcumulado: low.acumulado,
    lowestAcumuladoKey: low.key,
    firstNegativeAcumuladoKey: firstNeg?.key ?? null,
    justaKeys: rows
      .filter((r) => r.compra > 0 && r.queda >= 0 && r.queda < r.entra * JUSTA_THRESHOLD)
      .map((r) => r.key),
    overLimitBy: cents(Math.max(0, overLimitBy)),
  };
}
