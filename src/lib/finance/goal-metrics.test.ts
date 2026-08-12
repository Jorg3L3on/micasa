import { describe, expect, it } from 'vitest';
import {
  compareActiveGoals,
  computeGoalMetrics,
} from '@/lib/finance/goal-metrics';

describe('computeGoalMetrics', () => {
  it('computes remaining and monthly tip like the mock (35499 / 3)', () => {
    const metrics = computeGoalMetrics({
      amount: 4501,
      goal_amount: 40000,
      goal_due_date: '2026-10-17',
      created_at: '2026-06-01',
      active: true,
      today: '2026-08-11',
    });
    expect(metrics.remaining).toBe(35499);
    expect(metrics.daysLeft).toBe(67);
    expect(metrics.monthlyTip).toBe(35499 / 3);
    expect(metrics.status).toBe('active');
  });

  it('keeps early-funded goals active until the due date', () => {
    const metrics = computeGoalMetrics({
      amount: 5000,
      goal_amount: 4000,
      goal_due_date: '2026-12-01',
      created_at: '2026-01-01',
      active: true,
      today: '2026-08-11',
    });
    expect(metrics.remaining).toBe(0);
    expect(metrics.monthlyTip).toBe(0);
    expect(metrics.status).toBe('active');
    expect(metrics.savedProgress).toBe(1);
    expect(metrics.isComplete).toBe(false);
  });

  it('marks fully funded goals Completada once due date arrives', () => {
    const metrics = computeGoalMetrics({
      amount: 5000,
      goal_amount: 4000,
      goal_due_date: '2026-08-11',
      created_at: '2026-01-01',
      active: true,
      today: '2026-08-11',
    });
    expect(metrics.status).toBe('achieved');
    expect(metrics.isComplete).toBe(true);
    expect(metrics.savedProgress).toBe(1);
  });

  it('marks inactive goals as archived', () => {
    const metrics = computeGoalMetrics({
      amount: 100,
      goal_amount: 1000,
      goal_due_date: '2026-12-01',
      created_at: '2026-01-01',
      active: false,
      today: '2026-08-11',
    });
    expect(metrics.status).toBe('archived');
    expect(metrics.isComplete).toBe(true);
    expect(metrics.savedProgress).toBe(0.1);
    expect(metrics.progressToday).toBe(1);
  });

  it('marks overdue when due date passed and not achieved', () => {
    const metrics = computeGoalMetrics({
      amount: 100,
      goal_amount: 1000,
      goal_due_date: '2026-08-01',
      created_at: '2026-01-01',
      active: true,
      today: '2026-08-11',
    });
    expect(metrics.status).toBe('overdue');
    expect(metrics.savedProgress).toBe(0.1);
  });

  it('prefers Completada over Vencida when fully funded past due', () => {
    const metrics = computeGoalMetrics({
      amount: 1000,
      goal_amount: 1000,
      goal_due_date: '2026-08-01',
      created_at: '2026-01-01',
      active: true,
      today: '2026-08-11',
    });
    expect(metrics.status).toBe('achieved');
  });

  it('marks funded goals without due date as Completada', () => {
    const metrics = computeGoalMetrics({
      amount: 1000,
      goal_amount: 1000,
      goal_due_date: null,
      created_at: '2026-01-01',
      active: true,
      today: '2026-08-11',
    });
    expect(metrics.status).toBe('achieved');
  });

  it('computes savedProgress from balance / goal', () => {
    const metrics = computeGoalMetrics({
      amount: 300,
      goal_amount: 2000,
      goal_due_date: '2026-12-01',
      created_at: '2026-01-01',
      active: true,
      today: '2026-08-11',
    });
    expect(metrics.savedProgress).toBe(0.15);
    expect(metrics.status).toBe('active');
  });

  it('clamps progressToday between 0 and 1', () => {
    const before = computeGoalMetrics({
      amount: 0,
      goal_amount: 1000,
      goal_due_date: '2026-12-01',
      created_at: '2026-06-01',
      today: '2026-01-01',
    });
    expect(before.progressToday).toBe(0);

    const after = computeGoalMetrics({
      amount: 0,
      goal_amount: 1000,
      goal_due_date: '2026-06-01',
      created_at: '2026-01-01',
      today: '2026-12-01',
    });
    expect(after.progressToday).toBe(1);
    expect(after.status).toBe('overdue');
  });
});

describe('compareActiveGoals', () => {
  it('puts incomplete goals before funded ones', () => {
    const incomplete = {
      name: 'B',
      amount: 40,
      goal_amount: 100,
      goal_due_date: '2026-12-01',
    };
    const funded = {
      name: 'A',
      amount: 100,
      goal_amount: 100,
      goal_due_date: '2026-09-01',
    };
    expect(compareActiveGoals(incomplete, funded)).toBeLessThan(0);
    expect(compareActiveGoals(funded, incomplete)).toBeGreaterThan(0);
  });

  it('sorts incomplete goals by earliest due date', () => {
    const sooner = {
      name: 'Soon',
      amount: 10,
      goal_amount: 100,
      goal_due_date: '2026-09-01',
    };
    const later = {
      name: 'Later',
      amount: 10,
      goal_amount: 100,
      goal_due_date: '2026-12-01',
    };
    expect([later, sooner].sort(compareActiveGoals).map((g) => g.name)).toEqual(
      ['Soon', 'Later'],
    );
  });

  it('keeps incompletes ahead even when funded has an earlier due date', () => {
    const incompleteLater = {
      name: 'Incomplete',
      amount: 10,
      goal_amount: 100,
      goal_due_date: '2026-12-01',
    };
    const fundedSooner = {
      name: 'Funded',
      amount: 100,
      goal_amount: 100,
      goal_due_date: '2026-08-01',
    };
    expect(
      [fundedSooner, incompleteLater].sort(compareActiveGoals).map((g) => g.name),
    ).toEqual(['Incomplete', 'Funded']);
  });
});
