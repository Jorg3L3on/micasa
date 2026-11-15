import { buildPurchasePlan, type PlanWallet } from '@/lib/finance/purchase-simulation/plan';
import {
  buildQuincenaSeries,
  defaultHorizonEnd,
  listQuincenas,
  purchaseFlows,
  verdictFacts,
  type BaselineFlow,
} from '@/lib/finance/purchase-simulation/series';
import { buildDebtSeries } from '@/lib/finance/purchase-simulation/debt';
import type {
  PurchaseSimulationResult,
  SimulationWallet,
} from '@/lib/finance/purchase-simulation/purchase-simulation.service';

/** Fictional data for UI tests: two cards and one debit wallet. */
export const TEST_WALLETS: SimulationWallet[] = [
  { id: 7, name: 'Tarjeta Uno', type: 'CREDIT_CARD', isCard: true, providerIconKey: null, balance: null, debt: 8900, limit: 25000, available: 16100, cutoffDay: 5, dueDay: 25, aprAnnualPct: 48 },
  { id: 8, name: 'Tarjeta Dos', type: 'CREDIT_CARD', isCard: true, providerIconKey: null, balance: null, debt: 8200, limit: 30000, available: 21800, cutoffDay: 20, dueDay: 10, aprAnnualPct: 42 },
  { id: 3, name: 'Débito prueba', type: 'DEBIT_CARD', isCard: false, providerIconKey: null, balance: 45000, debt: null, limit: null, available: null, cutoffDay: null, dueDay: null, aprAnnualPct: null },
];

const baseline = (today: string, until: string, tightSecond: boolean): BaselineFlow[] =>
  listQuincenas(today, until).flatMap((ref) => {
    const date = `${ref.year}-${String(ref.month).padStart(2, '0')}-${ref.period === 'FIRST' ? '13' : '27'}`;
    const tight = tightSecond && ref.period === 'SECOND' && (ref.month === 12 || ref.month === 1);
    return [
      { date, amount: 16500, kind: 'income' as const, name: 'Sueldo', walletName: 'Débito prueba', estimated: false },
      { date, amount: tight ? 16250 : 14700, kind: 'template' as const, name: 'Renta y servicios', walletName: 'Débito prueba', estimated: false },
    ];
  });

/** Builds a result like the API would for a body, with the real pure engine. */
export function fakeSimulation(body: {
  total: number; date: string; mode: 'contado' | 'msi' | 'credito'; wallet_id?: number; months?: number;
  pay_wallet_id?: number; annual_rate?: number; down_payment?: number; name?: string;
}, today: string): PurchaseSimulationResult {
  const wallet = TEST_WALLETS.find((w) => w.id === (body.wallet_id ?? body.pay_wallet_id)) ?? TEST_WALLETS[2];
  const pw: PlanWallet = { id: wallet.id, name: wallet.name, isCard: wallet.isCard, cutoff_day: wallet.cutoffDay, due_day: wallet.dueDay };
  const plan = buildPurchasePlan({
    total: body.total, date: body.date, mode: body.mode, wallet: pw, months: body.months, lender: 'new',
    annualRatePct: body.annual_rate, downPayment: body.down_payment, payWallet: { id: 3, name: 'Débito prueba' }, downWallet: { id: 3, name: 'Débito prueba' },
  });
  const until = defaultHorizonEnd(plan);
  const name = body.name ?? 'tu compra';
  const series = buildQuincenaSeries({
    todayYmd: today, untilYmd: until, startingLiquidity: 45000,
    baseline: baseline(today, until, true), purchase: purchaseFlows(plan, name, until),
    createdKeys: new Set(listQuincenas(today, until).slice(0, 4).map((r) => `${r.year}-${String(r.month).padStart(2, '0')}-${r.period === 'FIRST' ? 1 : 2}`)),
  });
  const verdict = verdictFacts(series, 0);
  return {
    as_of: today, until, starting_liquidity: 45000, last_created_quincena: series[3]?.key ?? null,
    wallets: TEST_WALLETS, plan, series, verdict,
    debt: buildDebtSeries({ todayYmd: today, untilYmd: until, cards: [{ id: 7, name: 'Tarjeta Uno', providerIconKey: null, limit: 25000, debtToday: 8900, statementPayments: [], consumptionFloor: null }], loans: [], plan, purchaseName: name }),
    alternatives: [
      { id: 'msi-8-12', label: '12 MSI · Tarjeta Dos', patch: { mode: 'msi', wallet_id: 8, months: 12 }, current: false, level: 'green', redCount: 0, quincenas: 28, tightestQueda: 1300, regularPayment: 500, count: 12, interest: 0, lastDueDate: '2027-11-10' },
    ],
    assumptions: ['No se guarda nada.'],
    card_consumption: [],
  };
}
