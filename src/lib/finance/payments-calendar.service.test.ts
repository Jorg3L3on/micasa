import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listUpcomingCommitmentsForMonth,
  expenseFindMany,
  fortnightFindMany,
  expenseTemplateFindMany,
  walletFindMany,
} = vi.hoisted(() => ({
  listUpcomingCommitmentsForMonth: vi.fn(),
  expenseFindMany: vi.fn(),
  fortnightFindMany: vi.fn(),
  expenseTemplateFindMany: vi.fn(),
  walletFindMany: vi.fn(),
}));

vi.mock('@/lib/mcp/upcoming-commitments.service', () => ({
  listUpcomingCommitmentsForMonth,
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    expense: {
      findMany: expenseFindMany,
    },
    fortnight: {
      findMany: fortnightFindMany,
    },
    expenseTemplate: {
      findMany: expenseTemplateFindMany,
    },
    wallet: {
      findMany: walletFindMany,
    },
  },
}));

import { listPaymentsCalendarForMonth } from '@/lib/finance/payments-calendar.service';
import {
  defaultSelectedCalendarDay,
  isViewedCivilCurrentMonth,
  itemsForCalendarDate,
  neighborCreatedMonth,
  pendingDatesFromCalendarItems,
} from '@/lib/finance/payments-calendar';
import {
  endOfCalendarDay,
  formatCalendarDate,
  parseCalendarDate,
  startOfCalendarDay,
} from '@/lib/calendar-dates';

const ownerFilter = { user_id: 1, house_id: null };

beforeEach(() => {
  vi.clearAllMocks();
  listUpcomingCommitmentsForMonth.mockResolvedValue({
    year: 2026,
    month: 9,
    items: [],
    period_total: 0,
  });
  // listUnpaidExpensesWithPaymentDate + existing-template check + due-day expenses
  expenseFindMany.mockResolvedValue([]);
  fortnightFindMany.mockResolvedValue([]);
  expenseTemplateFindMany.mockResolvedValue([]);
  walletFindMany.mockResolvedValue([
    { id: 10, type: 'DEBIT_CARD' },
  ]);
});

describe('listPaymentsCalendarForMonth', () => {
  it('maps commitment items and unpaid expenses with payment_date', async () => {
    listUpcomingCommitmentsForMonth.mockResolvedValue({
      year: 2026,
      month: 9,
      items: [
        {
          date: '2026-09-10',
          type: 'revolving',
          name: 'Pago tarjeta BBVA',
          amount: 1200,
          is_paid: false,
          source_id: 7,
          wallet_or_loan: 'BBVA',
        },
        {
          date: '2026-09-15',
          type: 'loan',
          name: 'Pagar a Banco',
          amount: 500,
          is_paid: false,
          source_id: 3,
          wallet_or_loan: 'Banco',
        },
      ],
      period_total: 1700,
    });
    expenseFindMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      if (args.where.payment_date) {
        return [
          {
            id: 42,
            description: 'Renta',
            amount: 8000,
            payment_date: parseCalendarDate('2026-09-05'),
          },
        ];
      }
      return [];
    });

    const result = await listPaymentsCalendarForMonth(ownerFilter, 2026, 9);

    expect(listUpcomingCommitmentsForMonth).toHaveBeenCalledWith(
      ownerFilter,
      2026,
      9,
    );
    expect(result.items).toEqual([
      {
        date: '2026-09-05',
        type: 'expense',
        name: 'Renta',
        amount: 8000,
        sourceId: 42,
        typeLabel: 'Gasto',
      },
      {
        date: '2026-09-10',
        type: 'revolving',
        name: 'Pago tarjeta BBVA',
        amount: 1200,
        sourceId: 7,
        typeLabel: 'Tarjeta',
      },
      {
        date: '2026-09-15',
        type: 'loan',
        name: 'Pagar a Banco',
        amount: 500,
        sourceId: 3,
        typeLabel: 'Préstamo',
      },
    ]);
  });

  it('queries only expenses with payment_date in the month range', async () => {
    await listPaymentsCalendarForMonth(ownerFilter, 2026, 2);

    const datedCall = expenseFindMany.mock.calls.find(
      (call) => call[0]?.where?.payment_date,
    )?.[0];
    expect(datedCall.where.payment_date.gte).toEqual(
      startOfCalendarDay('2026-02-01'),
    );
    expect(datedCall.where.payment_date.lte).toEqual(
      endOfCalendarDay('2026-02-28'),
    );
    expect(formatCalendarDate(datedCall.where.payment_date.lte)).toBe(
      '2026-02-28',
    );
  });

  const mockScheduledExpenseFortnights = () => {
    fortnightFindMany.mockImplementation(
      async (args: { select: Record<string, unknown> }) => {
        // Template obligations select end_date; the due_day query does not.
        if (args.select.end_date) return [];
        return [
          { id: 1, year: 2026, month: 9, period: 'FIRST' },
          { id: 2, year: 2026, month: 9, period: 'SECOND' },
          { id: 3, year: 2026, month: 10, period: 'FIRST' },
        ];
      },
    );
  };

  it('includes unpaid expenses scheduled by due_day without payment_date', async () => {
    mockScheduledExpenseFortnights();
    expenseFindMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      if (args.where.payment_date === null) {
        return [
          {
            id: 55,
            description: 'Netflix',
            amount: 199,
            due_day: 20,
            fortnight_id: 2,
          },
        ];
      }
      return [];
    });

    const result = await listPaymentsCalendarForMonth(ownerFilter, 2026, 9);
    expect(result.items).toContainEqual({
      date: '2026-09-20',
      type: 'expense',
      name: 'Netflix',
      amount: 199,
      sourceId: 55,
      typeLabel: 'Gasto',
    });
  });

  it('places next month FIRST due on the last day into the viewed month', async () => {
    mockScheduledExpenseFortnights();
    expenseFindMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      if (args.where.payment_date === null) {
        return [
          {
            id: 56,
            description: 'Sky',
            amount: 269,
            due_day: 30,
            fortnight_id: 3,
          },
        ];
      }
      return [];
    });

    const result = await listPaymentsCalendarForMonth(ownerFilter, 2026, 9);
    expect(result.items).toContainEqual({
      date: '2026-09-30',
      type: 'expense',
      name: 'Sky',
      amount: 269,
      sourceId: 56,
      typeLabel: 'Gasto',
    });
  });

  it('includes not-yet-instantiated templates on their due day in the month', async () => {
    fortnightFindMany.mockResolvedValue([
      {
        id: 1,
        year: 2026,
        month: 9,
        period: 'SECOND',
        end_date: parseCalendarDate('2026-09-29'),
      },
    ]);
    expenseFindMany.mockResolvedValue([]); // no existing template expenses
    expenseTemplateFindMany.mockResolvedValue([
      {
        id: 9,
        name: 'Internet',
        suggested_amount: 650,
        wallet_id: 10,
        due_day: null,
        due_day_first_fortnight: null,
        due_day_second_fortnight: 18,
      },
    ]);

    const result = await listPaymentsCalendarForMonth(ownerFilter, 2026, 9);
    expect(result.items).toContainEqual({
      date: '2026-09-18',
      type: 'template',
      name: 'Internet',
      amount: 650,
      sourceId: 9,
      typeLabel: 'Plantilla',
    });
  });

  it('skips templates that already have an expense in the fortnight', async () => {
    fortnightFindMany.mockResolvedValue([
      {
        id: 1,
        year: 2026,
        month: 9,
        period: 'SECOND',
        end_date: parseCalendarDate('2026-09-29'),
      },
    ]);
    expenseFindMany.mockImplementation(async (args: { where: Record<string, unknown> }) => {
      if (args.where.expense_template_id) {
        return [{ fortnight_id: 1, expense_template_id: 9 }];
      }
      return [];
    });
    expenseTemplateFindMany.mockResolvedValue([
      {
        id: 9,
        name: 'Internet',
        suggested_amount: 650,
        wallet_id: 10,
        due_day: null,
        due_day_first_fortnight: null,
        due_day_second_fortnight: 18,
      },
    ]);

    const result = await listPaymentsCalendarForMonth(ownerFilter, 2026, 9);
    expect(result.items.some((item) => item.type === 'template')).toBe(false);
  });
});

describe('pendingDatesFromCalendarItems / itemsForCalendarDate', () => {
  const items = [
    {
      date: '2026-09-05',
      type: 'expense' as const,
      name: 'A',
      amount: 10,
      sourceId: 1,
      typeLabel: 'Gasto',
    },
    {
      date: '2026-09-05',
      type: 'loan' as const,
      name: 'B',
      amount: 20,
      sourceId: 2,
      typeLabel: 'Préstamo',
    },
    {
      date: '2026-09-12',
      type: 'msi' as const,
      name: 'C',
      amount: 30,
      sourceId: 3,
      typeLabel: 'Cuota',
    },
  ];

  it('lists unique pending dates sorted', () => {
    expect(pendingDatesFromCalendarItems(items)).toEqual([
      '2026-09-05',
      '2026-09-12',
    ]);
  });

  it('filters items for a day', () => {
    expect(itemsForCalendarDate(items, '2026-09-05')).toHaveLength(2);
    expect(itemsForCalendarDate(items, '2026-09-01')).toEqual([]);
  });
});

describe('defaultSelectedCalendarDay', () => {
  it('selects today in the current month', () => {
    expect(
      defaultSelectedCalendarDay({
        year: 2026,
        month: 9,
        isCurrentMonth: true,
        todayYmd: '2026-09-29',
        pendingDates: ['2026-09-05', '2026-09-12'],
      }),
    ).toBe('2026-09-29');
  });

  it('selects first pending day when not current month', () => {
    expect(
      defaultSelectedCalendarDay({
        year: 2026,
        month: 8,
        isCurrentMonth: false,
        todayYmd: '2026-09-29',
        pendingDates: ['2026-08-04', '2026-08-20'],
      }),
    ).toBe('2026-08-04');
  });

  it('falls back to the 1st when there are no pending days', () => {
    expect(
      defaultSelectedCalendarDay({
        year: 2026,
        month: 8,
        isCurrentMonth: false,
        todayYmd: '2026-09-29',
        pendingDates: [],
      }),
    ).toBe('2026-08-01');
  });
});

describe('neighborCreatedMonth / isViewedCivilCurrentMonth', () => {
  const months = [
    { year: 2026, month: 7 },
    { year: 2026, month: 8 },
    { year: 2026, month: 9 },
  ];

  it('returns adjacent created months and null at edges', () => {
    expect(neighborCreatedMonth(months, { year: 2026, month: 8 }, -1)).toEqual({
      year: 2026,
      month: 7,
    });
    expect(neighborCreatedMonth(months, { year: 2026, month: 8 }, 1)).toEqual({
      year: 2026,
      month: 9,
    });
    expect(neighborCreatedMonth(months, { year: 2026, month: 7 }, -1)).toBeNull();
    expect(neighborCreatedMonth(months, { year: 2026, month: 9 }, 1)).toBeNull();
  });

  it('detects civil current month from todayYmd', () => {
    expect(
      isViewedCivilCurrentMonth(2026, 9, '2026-09-29'),
    ).toBe(true);
    expect(
      isViewedCivilCurrentMonth(2026, 8, '2026-09-29'),
    ).toBe(false);
  });
});
