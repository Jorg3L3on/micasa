import { describe, expect, it } from 'vitest';
import {
  applyBatchResults,
  balanceBeforeEachRow,
  batchTotals,
  isBlankRow,
  newBatchRow,
  rowExceedsBalance,
  rowIssues,
  toBatchItems,
  type BatchRow,
} from './batch-entry';
import type { PaymentMethodOption } from '@/types/catalog';

const wallets: PaymentMethodOption[] = [
  { id: 1, name: 'Débito', type: 'DEBIT_CARD', amount: 100 },
  { id: 2, name: 'Crédito', type: 'CREDIT_CARD', amount: 0 },
];

const row = (over: Partial<BatchRow> = {}): BatchRow => ({
  ...newBatchRow(null, { date: '2026-10-15', walletId: 1 }),
  name: 'x',
  amount: 10,
  categoryId: 3,
  ...over,
});

describe('newBatchRow', () => {
  it('inherits wallet, date and kind but not name, amount or category', () => {
    const prev = row({ kind: 'income', walletId: 2, date: '2026-10-01', name: 'a', categoryId: 5 });
    const next = newBatchRow(prev, { date: '2026-10-15' });
    expect(next).toMatchObject({
      kind: 'income',
      walletId: 2,
      date: '2026-10-01',
      name: '',
      amount: '',
      categoryId: 0,
    });
    expect(next.clientId).not.toBe(prev.clientId);
  });
});

describe('rowIssues', () => {
  it('reports each missing required field', () => {
    const issues = rowIssues(row({ name: '', amount: '', walletId: 0, categoryId: 0 }), wallets);
    expect(Object.keys(issues).sort()).toEqual(['amount', 'categoryId', 'name', 'walletId']);
  });

  it('rejects incomes into credit wallets', () => {
    expect(rowIssues(row({ kind: 'income', walletId: 2 }), wallets).walletId).toBeDefined();
    expect(rowIssues(row({ kind: 'income', walletId: 1 }), wallets)).toEqual({});
  });
});

describe('running wallet balance', () => {
  it('subtracts earlier paid gastos and adds earlier ingresos', () => {
    const rows = [
      row({ amount: 60, isPaid: true }),
      row({ kind: 'income', amount: 500 }),
      row({ amount: 30, isPaid: true }),
    ];
    expect(balanceBeforeEachRow(rows, wallets)).toEqual([100, 40, 540]);
  });

  it('flags a later row that only exceeds the balance because of earlier rows', () => {
    const rows = [row({ amount: 70, isPaid: true }), row({ amount: 50, isPaid: true })];
    expect(rowExceedsBalance(rows, 0, wallets)).toBe(false);
    expect(rowExceedsBalance(rows, 1, wallets)).toBe(true);
  });

  it('does not count unpaid gastos or confirmed skip-balance rows', () => {
    const rows = [
      row({ amount: 70, isPaid: false }),
      row({ amount: 70, isPaid: true, skipWalletDelta: true }),
      row({ amount: 90, isPaid: true }),
    ];
    expect(rowExceedsBalance(rows, 2, wallets)).toBe(false);
  });

  it('never flags credit wallets', () => {
    expect(rowExceedsBalance([row({ walletId: 2, amount: 9999 })], 0, wallets)).toBe(false);
  });
});

describe('payload and results', () => {
  it('forces paid on credit cards and omits expense fields for ingresos', () => {
    const items = toBatchItems(
      [row({ walletId: 2, isPaid: false }), row({ kind: 'income', amount: 5 })],
      wallets,
    );
    expect(items[0]).toMatchObject({ kind: 'expense', isPaid: true });
    expect(items[1]).not.toHaveProperty('isPaid');
  });

  it('sends applyWalletDelta false only when confirmed', () => {
    const [a, b] = toBatchItems([row({ skipWalletDelta: true }), row()], wallets);
    expect(a.applyWalletDelta).toBe(false);
    expect(b).not.toHaveProperty('applyWalletDelta');
  });

  it('keeps only failed rows after a partial save', () => {
    const rows = [row(), row(), row()];
    const next = applyBatchResults(rows, {
      results: [
        { clientId: rows[0].clientId, status: 'created', id: 1 },
        { clientId: rows[1].clientId, status: 'failed', error: { code: 'X', message: 'mal' } },
        { clientId: rows[2].clientId, status: 'created', id: 2 },
      ],
      summary: { total: 3, created: 2, failed: 1 },
    });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ clientId: rows[1].clientId, status: 'failed' });
    expect(next[0].error?.message).toBe('mal');
  });
});

describe('helpers', () => {
  it('detects untouched rows and sums totals', () => {
    expect(isBlankRow(newBatchRow(null, { date: '2026-10-15' }))).toBe(true);
    expect(batchTotals([row({ amount: 10 }), row({ kind: 'income', amount: 25 })])).toEqual({
      expenses: 10,
      incomes: 25,
      net: 15,
    });
  });
});
