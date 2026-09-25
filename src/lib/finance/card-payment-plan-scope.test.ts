import { describe, expect, it } from 'vitest';
import { resolveCardPeriodObligation } from '@/lib/finance/card-period-obligation';
import {
  selectActivePlannedOverride,
  statementCycleForFortnight,
  statementCycleForMonth,
  toStoredPaymentPlanWrite,
  type StoredPaymentPlanWrite,
} from '@/lib/finance/card-payment-plan-scope';

const card = { cutoffDay: 15, dueDay: 20 };

const cycle = (year: number, month: number) =>
  statementCycleForMonth(year, month, card.cutoffDay, card.dueDay);

const write = (
  partial: Partial<StoredPaymentPlanWrite> & { amount: number },
): StoredPaymentPlanWrite => ({
  declaredZero: false,
  scope: 'this_cycle',
  cycleCount: null,
  validUntil: null,
  anchorStatementEnd: cycle(2026, 9).statementEnd,
  fortnightYear: 2026,
  fortnightMonth: 9,
  updatedAt: 1,
  createdAt: 1,
  ...partial,
});

describe('planned override validity', () => {
  it('keeps the latest write when the plan is edited several times', () => {
    const september = cycle(2026, 9);
    const active = selectActivePlannedOverride(
      [
        write({ amount: 100, updatedAt: 1, createdAt: 1 }),
        write({ amount: 400, updatedAt: 2, createdAt: 2 }),
        write({ amount: 800, updatedAt: 3, createdAt: 3 }),
      ],
      september,
      card,
    );

    expect(active.plannedOverride).toBe(800);
    expect(active.explicitZero).toBe(false);
  });

  it('shows a this-cycle override on both fortnights of that corte', () => {
    const firstCycle = statementCycleForFortnight(2026, 9, 'FIRST', 15, 20);
    const secondCycle = statementCycleForFortnight(2026, 9, 'SECOND', 15, 20);
    const plans = [write({ amount: 500 })];

    expect(firstCycle).toEqual(secondCycle);
    expect(selectActivePlannedOverride(plans, firstCycle, card).plannedOverride).toBe(500);
    expect(selectActivePlannedOverride(plans, secondCycle, card).plannedOverride).toBe(500);
  });

  it('covers exactly N statement cycles', () => {
    const plans = [
      write({
        amount: 600,
        scope: 'n_cycles',
        cycleCount: 2,
      }),
    ];

    expect(selectActivePlannedOverride(plans, cycle(2026, 9), card).plannedOverride).toBe(600);
    expect(selectActivePlannedOverride(plans, cycle(2026, 10), card).plannedOverride).toBe(600);
    expect(selectActivePlannedOverride(plans, cycle(2026, 11), card).plannedOverride).toBeNull();
  });

  it('expires an until-date override after the chosen day', () => {
    const plans = [
      write({
        amount: 700,
        scope: 'until_date',
        validUntil: '2026-10-20',
      }),
    ];

    expect(selectActivePlannedOverride(plans, cycle(2026, 9), card).plannedOverride).toBe(700);
    expect(selectActivePlannedOverride(plans, cycle(2026, 10), card).plannedOverride).toBe(700);
    expect(selectActivePlannedOverride(plans, cycle(2026, 11), card).plannedOverride).toBeNull();
  });

  it('does not reset the next period to 0 while the override is still in force', () => {
    const active = selectActivePlannedOverride(
      [write({ amount: 900, scope: 'n_cycles', cycleCount: 3 })],
      cycle(2026, 10),
      card,
    );
    const obligation = resolveCardPeriodObligation({
      outstandingBalance: 2_000,
      dueInPeriod: true,
      statementPayoff: null,
      plannedOverride: active.plannedOverride,
      explicitZero: active.explicitZero,
    });

    expect(active.plannedOverride).toBe(900);
    expect(obligation).toMatchObject({
      amount: 900,
      basis: 'planned_override',
      confidence: 'exact',
      gaps: [],
    });
  });

  it('reads DATE columns as UTC civil days under America/Mexico_City', () => {
    const previousTz = process.env.TZ;
    process.env.TZ = 'America/Mexico_City';
    try {
      const september = cycle(2026, 9);
      const october = cycle(2026, 10);
      const august = cycle(2026, 8);
      const anchor = new Date('2026-09-15T00:00:00.000Z');
      const validUntil = new Date('2026-10-20T00:00:00.000Z');

      const thisCycle = toStoredPaymentPlanWrite({
        planned_amount: 0,
        declared_zero: true,
        scope: 'this_cycle',
        anchor_statement_end: anchor,
        fortnight: { year: 2026, month: 9 },
      });
      expect(thisCycle.anchorStatementEnd).toBe('2026-09-15');
      expect(selectActivePlannedOverride([thisCycle], september, card).explicitZero).toBe(
        true,
      );
      expect(selectActivePlannedOverride([thisCycle], august, card).explicitZero).toBe(
        false,
      );

      const twoCycles = toStoredPaymentPlanWrite({
        planned_amount: 250,
        declared_zero: false,
        scope: 'n_cycles',
        cycle_count: 2,
        anchor_statement_end: anchor,
        fortnight: { year: 2026, month: 9 },
      });
      expect(selectActivePlannedOverride([twoCycles], september, card).plannedOverride).toBe(
        250,
      );
      expect(selectActivePlannedOverride([twoCycles], october, card).plannedOverride).toBe(
        250,
      );
      expect(selectActivePlannedOverride([twoCycles], august, card).plannedOverride).toBeNull();

      const untilDue = toStoredPaymentPlanWrite({
        planned_amount: 180,
        declared_zero: false,
        scope: 'until_date',
        valid_until: validUntil,
        anchor_statement_end: anchor,
        fortnight: { year: 2026, month: 9 },
      });
      expect(untilDue.validUntil).toBe('2026-10-20');
      expect(selectActivePlannedOverride([untilDue], october, card).plannedOverride).toBe(180);
      expect(selectActivePlannedOverride([untilDue], cycle(2026, 11), card).plannedOverride).toBeNull();
    } finally {
      if (previousTz == null) delete process.env.TZ;
      else process.env.TZ = previousTz;
    }
  });

  it('removing your own declaration leaves the corte missing, not $0', () => {
    const active = selectActivePlannedOverride([], cycle(2026, 9), card);
    expect(active.explicitZero).toBe(false);
    expect(active.plannedOverride).toBeNull();
    expect(
      resolveCardPeriodObligation({
        outstandingBalance: 2_000,
        dueInPeriod: true,
        statementPayoff: null,
        plannedOverride: active.plannedOverride,
        explicitZero: active.explicitZero,
      }),
    ).toMatchObject({ amount: null, confidence: 'missing', gaps: ['missing_statement_payoff'] });
  });

  it('reading the same plan again keeps the last amount', () => {
    const writes = [
      write({ amount: 400, updatedAt: 1 }),
      write({ amount: 900, updatedAt: 2 }),
    ];
    const september = cycle(2026, 9);
    const first = selectActivePlannedOverride(writes, september, card);
    const again = selectActivePlannedOverride(writes, september, card);
    expect(first.plannedOverride).toBe(900);
    expect(again.plannedOverride).toBe(900);
    expect(again.explicitZero).toBe(false);
  });

  it('keeps a later declared zero distinct from deleting the amount', () => {
    const active = selectActivePlannedOverride(
      [
        write({ amount: 900, updatedAt: 1 }),
        write({ amount: 0, declaredZero: true, updatedAt: 2 }),
      ],
      cycle(2026, 9),
      card,
    );

    expect(active.plannedOverride).toBeNull();
    expect(active.explicitZero).toBe(true);
    expect(
      resolveCardPeriodObligation({
        outstandingBalance: 2_000,
        dueInPeriod: true,
        statementPayoff: null,
        plannedOverride: active.plannedOverride,
        explicitZero: active.explicitZero,
      }),
    ).toMatchObject({ amount: 0, basis: 'none_declared', confidence: 'exact' });
  });
});
