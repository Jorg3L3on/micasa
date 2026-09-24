import { describe, expect, it } from 'vitest';
import { resolveCardPeriodObligation } from '@/lib/finance/card-period-obligation';
import {
  selectActivePlannedOverride,
  statementCycleForFortnight,
  statementCycleForMonth,
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
