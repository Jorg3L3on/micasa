import { describe, expect, it } from 'vitest';
import { buildPurchasePlan } from '@/lib/finance/purchase-simulation/plan';
import { buildQuincenaSeries, listQuincenas, purchaseFlows, verdictFacts, type BaselineFlow } from '@/lib/finance/purchase-simulation/series';
import { granularityFor, groupUnits, verdictCopy } from '@/components/wallets/liquidity/purchase/format';
import { PURCHASE_COPY } from '@/components/wallets/liquidity/purchase/copy';

const NOW = new Date('2026-11-14T18:00:00Z');
const TODAY = '2026-11-14';
const card = { id: 7, name: 'Tarjeta Uno', isCard: true, cutoff_day: 5, due_day: 25 };

const series = (outSecond: (month: number) => number, total: number, until = '2027-12-31') => {
  const flows: BaselineFlow[] = listQuincenas(TODAY, until).flatMap((r) => {
    const date = `${r.year}-${String(r.month).padStart(2, '0')}-${r.period === 'FIRST' ? '13' : '27'}`;
    return [
      { date, amount: 16500, kind: 'income' as const, name: 'Sueldo', walletName: 'D', estimated: false },
      { date, amount: r.period === 'FIRST' ? 14750 : outSecond(r.month), kind: 'template' as const, name: 'Gastos', walletName: 'D', estimated: false },
    ];
  });
  const plan = buildPurchasePlan({ total, date: TODAY, mode: 'msi', wallet: card, months: 12 });
  const rows = buildQuincenaSeries({ todayYmd: TODAY, untilYmd: until, startingLiquidity: 45000, baseline: flows, purchase: purchaseFlows(plan, 'X', until), createdKeys: new Set() });
  return { plan, rows };
};

describe('verdictCopy', () => {
  it('amber names the red quincenas and the cushion', () => {
    const { plan, rows } = series((m) => (m === 12 || m === 1 ? 16250 : 14700), 6000);
    const copy = verdictCopy(verdictFacts(rows, 0), rows, plan, 'Tarjeta Uno', NOW);
    expect(copy.chip).toBe(PURCHASE_COPY.chip.amber);
    expect(copy.headline).toBe('Te alcanza, pero aprieta 2 quincenas');
    expect(copy.sentence).toMatch(/^La 2ª de diciembre y la 2ª de enero quedarían en rojo: te faltarían hasta \$250\./);
    expect(copy.sentence).toMatch(/tu dinero acumulado no baja de/);
  });

  it('green says the tightest quincena', () => {
    const { plan, rows } = series(() => 14700, 6000);
    const copy = verdictCopy(verdictFacts(rows, 0), rows, plan, null, NOW);
    expect(copy.headline).toBe('Sí te alcanza');
    expect(copy.chip).toBe('Buena idea');
  });

  it('red explains over-limit', () => {
    const { plan, rows } = series(() => 14700, 6000);
    const copy = verdictCopy(verdictFacts(rows, 200), rows, plan, 'Tarjeta Uno', NOW);
    expect(copy.headline).toBe('No te alcanza');
    expect(copy.chip).toBe('Mala idea por ahora');
    expect(copy.sentence).toMatch(/Rebasa tu disponible en Tarjeta Uno por \$200/);
  });

  it('separates what was already red from what the purchase adds', () => {
    const { plan, rows } = series((m) => (m === 12 ? 17000 : m === 1 ? 16250 : 14700), 6000);
    const copy = verdictCopy(verdictFacts(rows, 0), rows, plan, null, NOW);
    expect(copy.sentence).toMatch(/Sin la compra ya tenías 2 quincenas en rojo; la compra agrega 1\./);
  });
});

describe('groupUnits', () => {
  it('picks quincena, mes or año by length', () => {
    expect(granularityFor(48)).toBe('quincena');
    expect(granularityFor(49)).toBe('mes');
    expect(granularityFor(240)).toBe('mes');
    expect(granularityFor(241)).toBe('año');
  });

  it('months sum both quincenas, count red ones and select the tightest', () => {
    const { rows } = series((m) => (m === 12 ? 16250 : 14700), 6000);
    const units = groupUnits(rows, 'mes', NOW);
    const dic = units.find((u) => u.key === '2026-12')!;
    expect(dic.keys).toEqual(['2026-12-1', '2026-12-2']);
    expect(dic.redCount).toBe(1);
    expect(dic.selectKey).toBe('2026-12-2');
    expect(dic.queda).toBe(rows[2].queda + rows[3].queda);
  });

  it('years group every quincena of the year', () => {
    const { rows } = series(() => 14700, 6000);
    const units = groupUnits(rows, 'año', NOW);
    // The last day of December belongs to the 1ª quincena of January.
    expect(units.map((u) => u.key)).toEqual(['2026', '2027', '2028']);
    expect(units[1].keys).toHaveLength(24);
  });
});

describe('quincenaMid', () => {
  it('adds the year to a past month and to months more than 11 ahead', async () => {
    const { quincenaMid } = await import('@/components/wallets/liquidity/purchase/format');
    expect(quincenaMid({ year: 2026, month: 4, period: 'SECOND' }, NOW)).toBe('2ª de abril de 2026');
    expect(quincenaMid({ year: 2026, month: 12, period: 'SECOND' }, NOW)).toBe('2ª de diciembre');
    expect(quincenaMid({ year: 2027, month: 12, period: 'FIRST' }, NOW)).toBe('1ª de diciembre de 2027');
  });
});

describe('niceTicks', () => {
  it('rounds the top just above the tallest bar with round steps', async () => {
    const { niceTicks } = await import('@/components/wallets/liquidity/purchase/format');
    expect(niceTicks(14_820, 0)).toEqual({ top: 15_000, bottom: 0, step: 5_000, ticks: [0, 5_000, 10_000, 15_000] });
    expect(niceTicks(9_030, 0).ticks).toEqual([0, 5_000, 10_000]);
    expect(niceTicks(2_400, 0).ticks).toEqual([0, 1_000, 2_000, 3_000]);
  });

  it('adds negative ticks and keeps $0', async () => {
    const { niceTicks } = await import('@/components/wallets/liquidity/purchase/format');
    const t = niceTicks(6_000, 2_000);
    expect(t.ticks).toContain(0);
    expect(t.bottom).toBeGreaterThanOrEqual(2_000);
    expect(t.top).toBeGreaterThanOrEqual(6_000);
  });

  it('handles an empty chart', async () => {
    const { niceTicks } = await import('@/components/wallets/liquidity/purchase/format');
    expect(niceTicks(0, 0).ticks).toContain(0);
  });
});
