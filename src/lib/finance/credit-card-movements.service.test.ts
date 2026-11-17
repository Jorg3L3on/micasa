import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCreditCardStatementByOwner: vi.fn(),
  listInstallmentPlansForCard: vi.fn(),
  listScheduledPaymentsForCard: vi.fn(),
}));

vi.mock('@/lib/finance/credit-card-statement.service', () => ({
  getCreditCardStatementByOwner: mocks.getCreditCardStatementByOwner,
}));
vi.mock('@/lib/finance/credit-card-installment-plan.service', () => ({
  listInstallmentPlansForCard: mocks.listInstallmentPlansForCard,
}));
vi.mock('@/lib/finance/credit-card-scheduled-payment.service', () => ({
  listScheduledPaymentsForCard: mocks.listScheduledPaymentsForCard,
}));

import { listCardMovementsForRange } from '@/lib/finance/credit-card-movements.service';

const OWNER = { user_id: null, house_id: 42 };

const purchase = (id: number, date: string, amount: number) => ({
  id,
  payment_date: `${date}T12:00:00.000Z`,
  description: `Compra ${id}`,
  amount,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCreditCardStatementByOwner.mockResolvedValue({
    outstanding_balance: 1800,
    current_cycle_start: '2026-08-06T00:00:00.000Z',
    current_cycle_end: '2026-09-05T00:00:00.000Z',
    statement_purchases: [purchase(1, '2026-07-20', 300), purchase(2, '2026-08-10', 120)],
    current_cycle_purchase_items: [purchase(2, '2026-08-10', 120), purchase(3, '2026-08-25', 60)],
    installment_active_purchases: [purchase(3, '2026-08-25', 60)],
    payment_history: [
      { id: 7, paid_at: '2026-08-15T18:00:00.000Z', note: null, source_wallet_name: 'Débito', amount: 500 },
    ],
  });
  mocks.listScheduledPaymentsForCard.mockResolvedValue([
    { id: 20, dueDate: '2026-08-30', status: 'SCHEDULED', label: null, amount: 200 },
    { id: 21, dueDate: '2026-08-31', status: 'PAID', label: 'Pagada', amount: 200 },
  ]);
  mocks.listInstallmentPlansForCard.mockResolvedValue([
    {
      name: 'Laptop',
      totalInstallments: 12,
      payments: [
        { id: 30, dueDate: '2026-09-01', status: 'SCHEDULED', sequence: 4, amount: 900 },
        { id: 31, dueDate: '2026-10-01', status: 'SCHEDULED', sequence: 5, amount: 900 },
      ],
    },
  ]);
});

describe('listCardMovementsForRange', () => {
  it('defaults to the current cycle, de-duplicates purchases and sorts by date', async () => {
    const result = await listCardMovementsForRange(8, OWNER, {});

    expect(result.from).toBe('2026-08-06');
    expect(result.to).toBe('2026-09-05');
    expect(result.balance).toBe(1800);
    expect(result.movements.map((m) => `${m.kind}:${m.id}`)).toEqual([
      'purchase:2',
      'payment:7',
      'purchase:3',
      'scheduled_payment:20',
      'installment:30',
    ]);
    expect(result.movements.find((m) => m.kind === 'installment')?.description).toBe(
      'Laptop (4/12)',
    );
  });

  it('honors an explicit range and leaves out covered scheduled payments', async () => {
    const result = await listCardMovementsForRange(8, OWNER, {
      from: '2026-07-01',
      to: '2026-08-31',
    });

    expect(result.movements.map((m) => `${m.kind}:${m.id}`)).toEqual([
      'purchase:1',
      'purchase:2',
      'payment:7',
      'purchase:3',
      'scheduled_payment:20',
    ]);
  });

  it('extends a range given only by its end 30 days back', async () => {
    const result = await listCardMovementsForRange(8, OWNER, { to: '2026-08-20' });

    expect(result.from).toBe('2026-07-22');
    expect(result.to).toBe('2026-08-20');
  });
});
