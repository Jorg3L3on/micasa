import { describe, expect, it } from 'vitest';
import { buildPurchasePlan, type PlanWallet } from '@/lib/finance/purchase-simulation/plan';
import {
  buildQuincenaSeries,
  defaultHorizonEnd,
  listQuincenas,
  purchaseFlows,
  verdictFacts,
  type BaselineFlow,
} from '@/lib/finance/purchase-simulation/series';

const TODAY = '2026-11-14';
const ml: PlanWallet = { id: 7, name: 'Tarjeta ML', isCard: true, cutoff_day: 5, due_day: 25 };
const azul: PlanWallet = { id: 8, name: 'Tarjeta Azul', isCard: true, cutoff_day: 20, due_day: 10 };

/** Fictional household: tight 2ª quincenas in diciembre and enero. */
const baseline = (until: string): BaselineFlow[] => {
  const flows: BaselineFlow[] = [];
  for (const ref of listQuincenas(TODAY, until)) {
    const mm = String(ref.month).padStart(2, '0');
    const first = ref.period === 'FIRST';
    const day = first ? '13' : '27';
    const date = `${ref.year}-${mm}-${day}`;
    flows.push({ date, amount: 16500, kind: 'income', name: 'Sueldo', walletName: 'Débito', estimated: false });
    let out = first ? 14750 : 14700;
    if (!first && ref.month === 12) out = 16200;
    if (!first && ref.month === 1) out = 16350;
    flows.push({ date, amount: out, kind: 'template', name: 'Gastos', walletName: 'Débito', estimated: false });
  }
  return flows;
};

const created = new Set(['2026-11-1', '2026-11-2', '2026-12-1', '2026-12-2']);

const run = (wallet: PlanWallet, months: number) => {
  const plan = buildPurchasePlan({ total: 6000, date: TODAY, mode: 'msi', wallet, months });
  const until = defaultHorizonEnd(plan);
  const series = buildQuincenaSeries({
    todayYmd: TODAY,
    untilYmd: until,
    baseline: baseline(until),
    purchase: purchaseFlows(plan, 'Carrito', until),
    createdKeys: created,
  });
  return { plan, series, facts: verdictFacts(series, 0) };
};

describe('buildQuincenaSeries', () => {
  it('Shein fixture: every cuota of 12 MSI on corte 5 / pago 25 lands in a 2ª quincena', () => {
    const { series } = run(ml, 12);
    const withPurchase = series.filter((r) => r.compra > 0);
    expect(withPurchase).toHaveLength(12);
    expect(withPurchase.every((r) => r.period === 'SECOND')).toBe(true);
    expect(series[0].key).toBe('2026-11-1');
    expect(series.at(-1)!.key).toBe('2027-11-2');
  });

  it('marks quincenas without a Fortnight row as estimated', () => {
    const { series } = run(ml, 12);
    expect(series.find((r) => r.key === '2026-12-2')!.estimated).toBe(false);
    expect(series.find((r) => r.key === '2027-01-1')!.estimated).toBe(true);
  });

  it('the purchase lowers queda by its cuota, and sinCompra stays the baseline', () => {
    const { series } = run(ml, 12);
    const withCuota = series.find((r) => r.compra > 0)!;
    expect(withCuota.compra).toBe(500);
    expect(withCuota.sinCompra - withCuota.queda).toBe(500);
  });

  it('budgets and other outflows reduce queda like Panel', () => {
    const series = buildQuincenaSeries({
      todayYmd: TODAY,
      untilYmd: '2026-11-29',
      baseline: [
        { date: '2026-11-20', amount: 1000, kind: 'income', name: 'Sueldo', walletName: 'D', estimated: false },
        { date: '2026-11-29', amount: 300, kind: 'budget', name: 'Súper', walletName: 'Presupuesto', estimated: false },
      ],
      purchase: [],
      createdKeys: new Set(),
    });
    expect(series.find((r) => r.key === '2026-11-2')!.queda).toBe(700);
  });

  it('past-due items land in the current quincena', () => {
    const series = buildQuincenaSeries({
      todayYmd: TODAY,
      untilYmd: '2026-11-29',
      baseline: [{ date: '2026-10-30', amount: 200, kind: 'expense', name: 'Vencido', walletName: 'D', estimated: false }],
      purchase: [],
      createdKeys: new Set(),
    });
    expect(series[0].comprometido).toBe(200);
  });
});

describe('verdictFacts', () => {
  it('amber: one or two quincenas in rojo', () => {
    const { facts } = run(ml, 12);
    expect(facts.level).toBe('amber');
    expect(facts.redKeys).toEqual(['2026-12-2', '2027-01-2']);
    expect(facts.newRedKeys).toEqual(facts.redKeys);
    expect(facts.baselineRedCount).toBe(0);
    expect(facts.tightestKey).toBe('2027-01-2');
  });

  it('green: the same cart on a card paid in the 1ª quincena', () => {
    const { facts } = run(azul, 12);
    expect(facts.level).toBe('green');
    expect(facts.redKeys).toHaveLength(0);
  });

  it('red from three quincenas in rojo on', () => {
    const plan = buildPurchasePlan({ total: 60000, date: TODAY, mode: 'msi', wallet: ml, months: 12 });
    const until = defaultHorizonEnd(plan);
    const series = buildQuincenaSeries({
      todayYmd: TODAY,
      untilYmd: until,
      baseline: baseline(until),
      purchase: purchaseFlows(plan, 'Sala', until),
      createdKeys: created,
    });
    const facts = verdictFacts(series, 0);
    expect(facts.redKeys.length).toBeGreaterThanOrEqual(3);
    expect(facts.level).toBe('red');
  });

  it('red when the purchase is over the card limit even if the money is there', () => {
    const { series } = run(azul, 12);
    expect(verdictFacts(series, 200).level).toBe('red');
  });
});

