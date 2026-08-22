import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findFirstWallet,
  findManyScheduled,
  findFirstScheduled,
  createScheduled,
  updateScheduled,
  deleteScheduled,
  findUniqueScheduled,
} = vi.hoisted(() => ({
  findFirstWallet: vi.fn(),
  findManyScheduled: vi.fn(),
  findFirstScheduled: vi.fn(),
  createScheduled: vi.fn(),
  updateScheduled: vi.fn(),
  deleteScheduled: vi.fn(),
  findUniqueScheduled: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    wallet: { findFirst: findFirstWallet },
    creditCardScheduledPayment: {
      findMany: findManyScheduled,
      findFirst: findFirstScheduled,
      create: createScheduled,
      update: updateScheduled,
      delete: deleteScheduled,
      findUnique: findUniqueScheduled,
    },
  },
}));

import {
  createScheduledPayment,
  getNextUncoveredScheduledPayment,
  listScheduledPaymentsForPlannerMonth,
} from '@/lib/finance/credit-card-scheduled-payment.service';
import { parseCalendarDate } from '@/lib/calendar-dates';

const ownerFilter = { user_id: 1, house_id: null } as const;

const creditWallet = {
  id: 5,
  type: 'CREDIT_CARD',
  user_id: 1,
  house_id: null,
};

describe('credit-card-scheduled-payment.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstWallet.mockResolvedValue(creditWallet);
  });

  it('creates scheduled payment without touching wallet debt', async () => {
    createScheduled.mockResolvedValue({
      id: 1,
      credit_card_wallet_id: 5,
      due_date: parseCalendarDate('2026-09-15'),
      amount: 1200,
      label: 'MSI prueba',
      status: 'SCHEDULED',
      paid_at: null,
    });

    const item = await createScheduledPayment(5, ownerFilter, {
      due_date: '2026-09-15',
      amount: 1200,
      label: 'MSI prueba',
    });

    expect(item).toMatchObject({
      id: 1,
      amount: 1200,
      dueDate: '2026-09-15',
      status: 'SCHEDULED',
    });
    expect(createScheduled).toHaveBeenCalledOnce();
  });

  it('returns earliest scheduled row as next uncovered', async () => {
    findFirstScheduled.mockResolvedValue({
      id: 2,
      credit_card_wallet_id: 5,
      due_date: parseCalendarDate('2026-08-20'),
      amount: 500,
      label: null,
      status: 'SCHEDULED',
      paid_at: null,
    });

    const next = await getNextUncoveredScheduledPayment(
      5,
      ownerFilter,
      '2026-08-01',
    );

    expect(next).toMatchObject({
      id: 2,
      amount: 500,
      dueDate: '2026-08-20',
    });
  });

  it('groups planner month scheduled rows by fortnight', async () => {
    findManyScheduled.mockResolvedValue([
      {
        id: 1,
        credit_card_wallet_id: 5,
        due_date: parseCalendarDate('2026-08-10'),
        amount: 300,
        label: null,
        status: 'SCHEDULED',
        paid_at: null,
        credit_card_wallet: {
          name: 'Tarjeta prueba',
          type: 'CREDIT_CARD',
          cutoff_day: 15,
          due_day: 5,
        },
      },
      {
        id: 2,
        credit_card_wallet_id: 5,
        due_date: parseCalendarDate('2026-08-20'),
        amount: 400,
        label: null,
        status: 'SCHEDULED',
        paid_at: null,
        credit_card_wallet: {
          name: 'Tarjeta prueba',
          type: 'CREDIT_CARD',
          cutoff_day: 15,
          due_day: 5,
        },
      },
    ]);

    const result = await listScheduledPaymentsForPlannerMonth(
      ownerFilter,
      2026,
      8,
    );

    expect(result.first).toHaveLength(1);
    expect(result.second).toHaveLength(1);
    expect(result.first[0].amount).toBe(300);
    expect(result.second[0].amount).toBe(400);
  });
});
