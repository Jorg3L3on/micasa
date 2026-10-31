import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@/lib/finance/domain-error';

const {
  categoryFindMany,
  walletFindMany,
  transaction,
  resolveOrCreateFortnight,
  createExpenseInTransaction,
  createExpenseTemplateForOwner,
  createWalletIncomeRecord,
} = vi.hoisted(() => ({
  categoryFindMany: vi.fn(),
  walletFindMany: vi.fn(),
  transaction: vi.fn(),
  resolveOrCreateFortnight: vi.fn(),
  createExpenseInTransaction: vi.fn(),
  createExpenseTemplateForOwner: vi.fn(),
  createWalletIncomeRecord: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    category: { findMany: categoryFindMany },
    wallet: { findMany: walletFindMany },
    $transaction: transaction,
  },
}));
vi.mock('@/lib/fortnights', () => ({ resolveOrCreateFortnight }));
vi.mock('@/lib/finance/expense.service', () => ({ createExpenseInTransaction }));
vi.mock('@/lib/finance/expense-template.service', () => ({
  createExpenseTemplateForOwner,
}));
vi.mock('@/lib/finance/income.service', () => ({ createWalletIncomeRecord }));

import { processTransactionBatch } from './transaction-batch.service';

const owner = {
  ownerType: 'user' as const,
  ownerId: 1,
  ownerFilter: { user_id: 1, house_id: null },
};

const expense = (over: Record<string, unknown> = {}) => ({
  kind: 'expense',
  clientId: 'e1',
  name: 'Café',
  categoryId: 10,
  amount: 45,
  walletId: 5,
  date: '2026-09-10',
  isPaid: true,
  ...over,
});

const income = (over: Record<string, unknown> = {}) => ({
  kind: 'income',
  clientId: 'i1',
  name: 'Sueldo',
  categoryId: 20,
  amount: 1000,
  walletId: 5,
  date: '2026-09-10',
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  categoryFindMany.mockResolvedValue([
    { id: 10, kind: 'EXPENSE', active: true },
    { id: 20, kind: 'INCOME', active: true },
  ]);
  walletFindMany.mockResolvedValue([{ id: 5, type: 'DEBIT_CARD' }]);
  resolveOrCreateFortnight.mockResolvedValue({ id: 100 });
  transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}));
  let nextId = 1;
  createExpenseInTransaction.mockImplementation(async () => ({ id: nextId++ }));
  createExpenseTemplateForOwner.mockResolvedValue({ id: 77 });
  createWalletIncomeRecord.mockImplementation(async () => ({ id: 900 }));
});

describe('processTransactionBatch', () => {
  it('saves mixed rows with one catalog load and one fortnight resolve', async () => {
    const res = await processTransactionBatch(owner, [
      expense(),
      expense({ clientId: 'e2', name: 'Súper', amount: 800 }),
      income(),
    ]);

    expect(res.summary).toEqual({ total: 3, created: 3, failed: 0 });
    expect(res.results.map((r) => r.clientId)).toEqual(['e1', 'e2', 'i1']);
    expect(categoryFindMany).toHaveBeenCalledTimes(1);
    expect(walletFindMany).toHaveBeenCalledTimes(1);
    expect(resolveOrCreateFortnight).toHaveBeenCalledTimes(1);
  });

  it('keeps valid rows when one fails and reports the failed one', async () => {
    createExpenseInTransaction
      .mockResolvedValueOnce({ id: 1 })
      .mockRejectedValueOnce(
        new DomainError('INSUFFICIENT_WALLET_BALANCE', 'Saldo insuficiente en la billetera'),
      );

    const res = await processTransactionBatch(owner, [
      expense(),
      expense({ clientId: 'e2', amount: 99999 }),
      income(),
    ]);

    expect(res.summary).toEqual({ total: 3, created: 2, failed: 1 });
    expect(res.results[1]).toEqual({
      clientId: 'e2',
      status: 'failed',
      error: {
        code: 'INSUFFICIENT_WALLET_BALANCE',
        message: 'Saldo insuficiente en la billetera',
        field: 'walletId',
      },
    });
    expect(res.results[2].status).toBe('created');
  });

  it('runs rows in order so later rows see earlier wallet changes', async () => {
    const order: string[] = [];
    createExpenseInTransaction.mockImplementation(async (_tx, input) => {
      order.push(input.description);
      return { id: order.length };
    });
    await processTransactionBatch(owner, [
      expense({ name: 'uno' }),
      expense({ clientId: 'e2', name: 'dos' }),
      expense({ clientId: 'e3', name: 'tres' }),
    ]);
    expect(order).toEqual(['uno', 'dos', 'tres']);
  });

  it('fails invalid rows without touching the database', async () => {
    const res = await processTransactionBatch(owner, [
      expense({ amount: 0 }),
      { kind: 'nope', clientId: 'x' },
    ]);
    expect(res.summary.failed).toBe(2);
    expect(res.results[0]).toMatchObject({
      clientId: 'e1',
      status: 'failed',
      error: { code: 'VALIDATION', field: 'amount' },
    });
    expect(res.results[1]).toMatchObject({ clientId: 'x', status: 'failed' });
    expect(categoryFindMany).not.toHaveBeenCalled();
    expect(createExpenseInTransaction).not.toHaveBeenCalled();
  });

  it('rejects a category of the wrong kind and an unknown wallet', async () => {
    const res = await processTransactionBatch(owner, [
      expense({ categoryId: 20 }),
      expense({ clientId: 'e2', walletId: 99 }),
    ]);
    expect(res.results[0]).toMatchObject({
      status: 'failed',
      error: { code: 'CATEGORY_NOT_FOUND', field: 'categoryId' },
    });
    expect(res.results[1]).toMatchObject({
      status: 'failed',
      error: { code: 'WALLET_NOT_FOUND', field: 'walletId' },
    });
  });

  it('refuses incomes into credit wallets', async () => {
    walletFindMany.mockResolvedValue([{ id: 5, type: 'CREDIT_CARD' }]);
    const res = await processTransactionBatch(owner, [income()]);
    expect(res.results[0]).toMatchObject({
      status: 'failed',
      error: { code: 'INVALID_WALLET_TYPE' },
    });
    expect(createWalletIncomeRecord).not.toHaveBeenCalled();
  });

  it('creates a template and both fortnight expenses for recurring "ambas quincenas"', async () => {
    resolveOrCreateFortnight
      .mockResolvedValueOnce({ id: 100 })
      .mockResolvedValueOnce({ id: 101 });
    const res = await processTransactionBatch(owner, [
      expense({
        date: '2026-09-05',
        isRecurring: true,
        applyToBothFortnights: true,
      }),
    ]);
    expect(res.summary.created).toBe(1);
    expect(createExpenseTemplateForOwner).toHaveBeenCalledTimes(1);
    expect(createExpenseTemplateForOwner.mock.calls[0][1]).toMatchObject({
      dueDayFirst: 5,
      dueDaySecond: 16,
      appliesFirstFortnight: true,
      appliesSecondFortnight: true,
    });
    expect(createExpenseInTransaction).toHaveBeenCalledTimes(2);
    expect(createExpenseInTransaction.mock.calls[1][1]).toMatchObject({
      fortnightId: 101,
      paymentDate: '2026-09-16',
      expenseTemplateId: 77,
    });
  });

  it('fails a recurring row whose date cannot form a valid template', async () => {
    // The 15th belongs to SECOND, whose due day must be 16 to 31.
    const res = await processTransactionBatch(owner, [
      expense({ date: '2026-09-15', isRecurring: true }),
    ]);
    expect(res.results[0]).toMatchObject({
      status: 'failed',
      error: { code: 'VALIDATION', field: 'date' },
    });
    expect(createExpenseInTransaction).not.toHaveBeenCalled();
  });
});
