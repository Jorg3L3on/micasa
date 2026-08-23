import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCalendarDate } from '@/lib/calendar-dates';
import { liquidityUntilFromMonthHorizon } from '@/lib/finance/liquidity-projection';

const { findManyLoan, findManyWallet, findManyExpense, findManyInstallmentPlan } =
  vi.hoisted(() => ({
    findManyLoan: vi.fn(),
    findManyWallet: vi.fn(),
    findManyExpense: vi.fn(),
    findManyInstallmentPlan: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  default: {
    loan: { findMany: findManyLoan },
    wallet: { findMany: findManyWallet },
    expense: { findMany: findManyExpense },
    creditCardInstallmentPlan: { findMany: findManyInstallmentPlan },
  },
}));

vi.mock('@/lib/observability/finance-log', () => ({
  logFinanceEvent: vi.fn(),
}));

import {
  collectInstallmentPlanProjectionData,
  collectLiquidityProjectionTimeline,
} from '@/lib/finance/liquidity-projection-events';
import { logFinanceEvent } from '@/lib/observability/finance-log';

const userOwner = { user_id: 1, house_id: null } as const;
const monthKeys = ['2026-03', '2026-04', '2026-05'];

describe('liquidity-projection-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findManyLoan.mockResolvedValue([]);
    findManyWallet.mockResolvedValue([]);
    findManyExpense.mockResolvedValue([]);
    findManyInstallmentPlan.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('computes until date from month horizon', () => {
    const asOf = parseCalendarDate('2026-03-10');
    expect(liquidityUntilFromMonthHorizon(asOf, 3)).toEqual(
      parseCalendarDate('2026-06-10'),
    );
    expect(liquidityUntilFromMonthHorizon(asOf, 12)).toEqual(
      parseCalendarDate('2027-03-10'),
    );
  });

  it('returns empty installment plan data when prisma query fails', async () => {
    findManyInstallmentPlan.mockRejectedValue(new Error('relation does not exist'));

    const result = await collectInstallmentPlanProjectionData(
      userOwner,
      parseCalendarDate('2026-03-10'),
      monthKeys,
    );

    expect(result.tracks).toEqual([]);
    expect(result.completionEvents).toEqual([]);
    expect([...result.paymentsByMonth.values()]).toEqual([0, 0, 0]);
    expect(logFinanceEvent).toHaveBeenCalledWith(
      'warn',
      'finance.liquidity_projection.installment_plan_collector_failed',
      expect.objectContaining({ error: 'relation does not exist' }),
    );
  });

  it('skips a broken installment plan without failing the batch', async () => {
    findManyInstallmentPlan.mockResolvedValue([
      {
        id: 1,
        name: 'OK plan',
        installment_amount: 100,
        credit_card_wallet: { id: 7, name: 'Visa' },
        payments: [
          {
            due_date: parseCalendarDate('2026-04-20'),
            amount: 100,
          },
        ],
      },
      {
        id: 2,
        name: 'Broken plan',
        installment_amount: 200,
        credit_card_wallet: null,
        payments: [
          {
            due_date: parseCalendarDate('2026-05-20'),
            amount: 200,
          },
        ],
      },
    ]);

    const result = await collectInstallmentPlanProjectionData(
      userOwner,
      parseCalendarDate('2026-03-10'),
      monthKeys,
    );

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]?.installment_plan_id).toBe(1);
    expect(logFinanceEvent).toHaveBeenCalledWith(
      'warn',
      'finance.liquidity_projection.installment_plan_skipped',
      expect.objectContaining({ installment_plan_id: 2 }),
    );
  });

  it('keeps liquidity timeline when installment plan collector rejects', async () => {
    findManyInstallmentPlan.mockRejectedValue(new Error('table missing'));

    const timeline = await collectLiquidityProjectionTimeline(
      userOwner,
      parseCalendarDate('2026-03-10'),
      '2026-06-10',
      monthKeys,
    );

    expect(timeline.events).toEqual([]);
    expect(timeline.tracks).toEqual([]);
    expect([...timeline.installmentPaymentsByMonth.values()]).toEqual([0, 0, 0]);
    expect(logFinanceEvent).toHaveBeenCalledWith(
      'warn',
      'finance.liquidity_projection.installment_plan_collector_failed',
      expect.objectContaining({ error: 'table missing' }),
    );
  });
});
