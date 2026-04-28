import { describe, expect, it } from 'vitest';
import { computePantryInsights } from '@/lib/server/pantry/compute-pantry-insights';

describe('computePantryInsights', () => {
  it('builds spend by store and buy-better recommendations', () => {
    const insights = computePantryInsights([
      {
        title: 'A',
        grand_total: 100,
        currency: 'MXN',
        store: 'WALMART',
        purchased_at: new Date('2026-04-01T00:00:00.000Z'),
        created_at: new Date('2026-04-01T00:00:00.000Z'),
        lines: [
          { description: 'Leche', quantity: 1, line_total: 30, unit_price: 30 },
        ],
      },
      {
        title: 'B',
        grand_total: 100,
        currency: 'MXN',
        store: 'SORIANA',
        purchased_at: new Date('2026-04-10T00:00:00.000Z'),
        created_at: new Date('2026-04-10T00:00:00.000Z'),
        lines: [
          { description: 'Leche', quantity: 1, line_total: 24, unit_price: 24 },
        ],
      },
    ]);

    expect(insights.spend_by_store.length).toBe(2);
    expect(insights.buy_better_recommendations[0]?.recommended_store).toBe('SORIANA');
  });

  it('creates guardrail alert when latest month spikes', () => {
    const insights = computePantryInsights([
      {
        title: 'M1',
        grand_total: 100,
        currency: 'MXN',
        store: 'WALMART',
        purchased_at: new Date('2026-01-05T00:00:00.000Z'),
        created_at: new Date('2026-01-05T00:00:00.000Z'),
        lines: [{ description: 'Arroz', quantity: 1, line_total: 100, unit_price: 100 }],
      },
      {
        title: 'M2',
        grand_total: 110,
        currency: 'MXN',
        store: 'WALMART',
        purchased_at: new Date('2026-02-05T00:00:00.000Z'),
        created_at: new Date('2026-02-05T00:00:00.000Z'),
        lines: [{ description: 'Arroz', quantity: 1, line_total: 110, unit_price: 110 }],
      },
      {
        title: 'M3',
        grand_total: 105,
        currency: 'MXN',
        store: 'WALMART',
        purchased_at: new Date('2026-03-05T00:00:00.000Z'),
        created_at: new Date('2026-03-05T00:00:00.000Z'),
        lines: [{ description: 'Arroz', quantity: 1, line_total: 105, unit_price: 105 }],
      },
      {
        title: 'M4',
        grand_total: 220,
        currency: 'MXN',
        store: 'WALMART',
        purchased_at: new Date('2026-04-05T00:00:00.000Z'),
        created_at: new Date('2026-04-05T00:00:00.000Z'),
        lines: [{ description: 'Arroz', quantity: 1, line_total: 220, unit_price: 220 }],
      },
    ]);
    expect(insights.guardrail_alerts.length).toBeGreaterThan(0);
  });
});
