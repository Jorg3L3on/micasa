import { listQuincenas, type BaselineFlow } from '@/lib/finance/purchase-simulation/series';
import type { SimulationBaseline, SimulationWallet } from '@/lib/finance/purchase-simulation/simulate';

/** Fictional data for UI tests: two cards and one debit wallet. */
export const TEST_WALLETS: SimulationWallet[] = [
  { id: 7, name: 'Tarjeta Uno', type: 'CREDIT_CARD', isCard: true, providerIconKey: null, balance: null, debt: 8900, limit: 25000, available: 16100, cutoffDay: 5, dueDay: 25, aprAnnualPct: 48 },
  { id: 8, name: 'Tarjeta Dos', type: 'CREDIT_CARD', isCard: true, providerIconKey: null, balance: null, debt: 20200, limit: 30000, available: 9800, cutoffDay: 20, dueDay: 10, aprAnnualPct: 42 },
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

/** The quincenas the GET would send: tight 2ª quincenas in diciembre and enero, the first four created. */
export function fakeBaseline(today: string, until: string): SimulationBaseline {
  return {
    as_of: today,
    until,
    flows: baseline(today, until, true),
    created_keys: listQuincenas(today, until).slice(0, 4).map((r) => `${r.year}-${String(r.month).padStart(2, '0')}-${r.period === 'FIRST' ? 1 : 2}`),
    card_consumption: [],
  };
}
