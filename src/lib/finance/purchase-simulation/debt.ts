import { ymdForDayInMonth } from '@/lib/calendar-dates';
import { pendingPrincipalAt, type PurchasePlan } from '@/lib/finance/purchase-simulation/plan';

/**
 * Purchase simulation (MIC-I17-2): what each card and loan would owe at every
 * month-end, with and without the purchase. Pure.
 */

export type CardDebtInput = {
  id: number;
  name: string;
  providerIconKey: string | null;
  limit: number | null;
  /** Debt recorded today (wallet.amount), MSI and plans included. */
  debtToday: number;
  /** Baseline statement payments from today on, which lower the debt on their due date. */
  statementPayments: { date: string; amount: number }[];
  /** Estimated habitual consumption kept on the card from the first estimated cycle on. */
  consumptionFloor: { fromDate: string; amount: number } | null;
};

export type LoanDebtInput = {
  id: number;
  name: string;
  /** Scheduled payments still to pay. */
  payments: { date: string; amount: number }[];
};

export type DebtSeriesWallet = {
  id: string;
  kind: 'card' | 'loan' | 'new';
  walletId: number | null;
  name: string;
  providerIconKey: string | null;
  limit: number | null;
  includesPurchase: boolean;
  values: number[];
  valuesSinCompra: number[];
};

export type DebtSeries = {
  /** First point is today, then each month-end through the horizon. */
  points: string[];
  wallets: DebtSeriesWallet[];
  totals: number[];
  totalsSinCompra: number[];
};

const cents = (n: number) => Math.round(n * 100) / 100;

export const monthEnds = (todayYmd: string, untilYmd: string): string[] => {
  const out = [todayYmd];
  let y = Number(todayYmd.slice(0, 4));
  let m = Number(todayYmd.slice(5, 7));
  for (let guard = 0; guard < 400; guard++) {
    const end = ymdForDayInMonth(`${y}-${String(m).padStart(2, '0')}`, 31)!;
    if (end > todayYmd) out.push(end);
    if (end >= untilYmd) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
};

export function buildDebtSeries(input: {
  todayYmd: string;
  untilYmd: string;
  cards: CardDebtInput[];
  loans: LoanDebtInput[];
  plan: PurchasePlan;
  purchaseName: string;
}): DebtSeries {
  const points = monthEnds(input.todayYmd, input.untilYmd);
  const { plan } = input;
  const wallets: DebtSeriesWallet[] = [];

  for (const card of input.cards) {
    const base = points.map((t) => {
      const paid = card.statementPayments
        .filter((p) => p.date >= input.todayYmd && p.date <= t)
        .reduce((s, p) => s + p.amount, 0);
      const floor =
        card.consumptionFloor && t >= card.consumptionFloor.fromDate ? card.consumptionFloor.amount : 0;
      return cents(Math.max(0, card.debtToday - paid) + floor);
    });
    const sim = plan.debtWalletId === card.id;
    wallets.push({
      id: `card-${card.id}`,
      kind: 'card',
      walletId: card.id,
      name: card.name,
      providerIconKey: card.providerIconKey,
      limit: card.limit,
      includesPurchase: sim,
      valuesSinCompra: base,
      values: sim ? base.map((v, i) => cents(v + pendingPrincipalAt(plan, points[i]))) : base,
    });
  }

  for (const loan of input.loans) {
    const values = points.map((t) =>
      cents(loan.payments.filter((p) => p.date > t).reduce((s, p) => s + p.amount, 0)),
    );
    if (values.every((v) => v === 0)) continue;
    wallets.push({
      id: `loan-${loan.id}`,
      kind: 'loan',
      walletId: null,
      name: loan.name,
      providerIconKey: null,
      limit: null,
      includesPurchase: false,
      values,
      valuesSinCompra: values,
    });
  }

  if (plan.debtWalletId === 'new') {
    wallets.push({
      id: 'new',
      kind: 'new',
      walletId: null,
      name: `Crédito · ${input.purchaseName}`,
      providerIconKey: null,
      limit: null,
      includesPurchase: true,
      values: points.map((t) => pendingPrincipalAt(plan, t)),
      valuesSinCompra: points.map(() => 0),
    });
  }

  const sum = (key: 'values' | 'valuesSinCompra') =>
    points.map((_, i) => cents(wallets.reduce((s, w) => s + w[key][i], 0)));
  return { points, wallets, totals: sum('values'), totalsSinCompra: sum('valuesSinCompra') };
}
