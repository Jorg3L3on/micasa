import { isValidCalendarDateString } from '@/lib/calendar-dates';
import {
  isSpendableExpenseWalletType,
  paidExpenseExceedsWalletBalance,
} from '@/lib/finance/expense-wallet-balance';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import type { PaymentMethodOption } from '@/types/catalog';
import type {
  BatchItemError,
  BatchResponse,
} from '@/types/transaction-batch';

export type BatchRowKind = 'expense' | 'income';
export type BatchRowStatus = 'draft' | 'saving' | 'failed';

export type BatchRow = {
  clientId: string;
  kind: BatchRowKind;
  name: string;
  /** Empty string while the user has not typed an amount yet. */
  amount: number | '';
  date: string;
  /** 0 = not selected. */
  walletId: number;
  categoryId: number;
  isPaid: boolean;
  isRecurring: boolean;
  applyToBothFortnights: boolean;
  /** Confirmed "guardar sin afectar saldo" for a paid expense above the balance. */
  skipWalletDelta: boolean;
  status: BatchRowStatus;
  error?: BatchItemError;
};

export type BatchRowField =
  | 'name'
  | 'amount'
  | 'date'
  | 'walletId'
  | 'categoryId';

export type BatchRowIssues = Partial<Record<BatchRowField, string>>;

let counter = 0;
export const newClientId = (): string => {
  counter += 1;
  return `row-${Date.now().toString(36)}-${counter}`;
};

/**
 * New row after `prev`: wallet, date and kind are inherited (never locked);
 * name, amount and category always start empty.
 */
export function newBatchRow(
  prev: Pick<BatchRow, 'kind' | 'walletId' | 'date'> | null,
  defaults: { date: string; walletId?: number; kind?: BatchRowKind },
): BatchRow {
  return {
    clientId: newClientId(),
    kind: prev?.kind ?? defaults.kind ?? 'expense',
    name: '',
    amount: '',
    date: prev?.date ?? defaults.date,
    walletId: prev?.walletId ?? defaults.walletId ?? 0,
    categoryId: 0,
    isPaid: false,
    isRecurring: false,
    applyToBothFortnights: false,
    skipWalletDelta: false,
    status: 'draft',
  };
}

export const duplicateBatchRow = (row: BatchRow): BatchRow => ({
  ...row,
  clientId: newClientId(),
  status: 'draft',
  error: undefined,
  skipWalletDelta: false,
});

/** A row the user never touched is ignored at save time. */
export const isBlankRow = (row: BatchRow): boolean =>
  row.name.trim() === '' && (row.amount === '' || row.amount === 0);

export function rowIssues(
  row: BatchRow,
  wallets: PaymentMethodOption[],
): BatchRowIssues {
  const issues: BatchRowIssues = {};
  if (row.name.trim() === '') issues.name = 'El nombre es requerido';
  if (row.amount === '' || !(Number(row.amount) > 0)) {
    issues.amount = 'El monto debe ser mayor a 0';
  }
  if (!isValidCalendarDateString(row.date)) issues.date = 'Fecha inválida';
  if (!row.walletId) issues.walletId = 'Selecciona la billetera';
  if (!row.categoryId) issues.categoryId = 'La categoría es requerida';

  const wallet = wallets.find((w) => w.id === row.walletId);
  if (row.kind === 'income' && wallet && !isSpendableExpenseWalletType(wallet.type)) {
    issues.walletId = 'Los ingresos van a efectivo, débito o metas';
  }
  return issues;
}

/** Credit cards always record the charge as paid (same rule as the single dialog). */
export const effectiveIsPaid = (
  row: BatchRow,
  wallets: PaymentMethodOption[],
): boolean => {
  if (row.kind !== 'expense') return false;
  const wallet = wallets.find((w) => w.id === row.walletId);
  return isCreditOrStoreCardWalletType(wallet?.type) ? true : row.isPaid;
};

/**
 * Balance of each wallet before every row, in row order: earlier paid gastos
 * subtract and earlier ingresos add. `balances[i]` is what row `i` sees.
 * Rows that cannot move money yet (blank, no wallet) are skipped.
 */
export function balanceBeforeEachRow(
  rows: BatchRow[],
  wallets: PaymentMethodOption[],
): number[] {
  const running = new Map<number, number>(
    wallets.map((w) => [w.id, Number(w.amount ?? 0)]),
  );
  return rows.map((row) => {
    const before = running.get(row.walletId) ?? 0;
    const amount = Number(row.amount || 0);
    const wallet = wallets.find((w) => w.id === row.walletId);
    if (wallet && amount > 0) {
      if (row.kind === 'income') {
        running.set(row.walletId, before + amount);
      } else if (
        isSpendableExpenseWalletType(wallet.type) &&
        effectiveIsPaid(row, wallets) &&
        !row.skipWalletDelta
      ) {
        running.set(row.walletId, before - amount);
      }
    }
    return before;
  });
}

/** True when this row is a paid gasto above what its wallet holds at that point of the batch. */
export function rowExceedsBalance(
  rows: BatchRow[],
  index: number,
  wallets: PaymentMethodOption[],
): boolean {
  const row = rows[index];
  if (!row || row.kind !== 'expense') return false;
  const wallet = wallets.find((w) => w.id === row.walletId);
  if (!wallet) return false;
  const balance = balanceBeforeEachRow(rows, wallets)[index];
  return paidExpenseExceedsWalletBalance({
    walletType: wallet.type,
    balance,
    amount: Number(row.amount || 0),
    isPaid: effectiveIsPaid(row, wallets),
  });
}

export type BatchTotals = { expenses: number; incomes: number; net: number };

export function batchTotals(rows: BatchRow[]): BatchTotals {
  let expenses = 0;
  let incomes = 0;
  for (const row of rows) {
    const amount = Number(row.amount || 0);
    if (!(amount > 0)) continue;
    if (row.kind === 'income') incomes += amount;
    else expenses += amount;
  }
  return { expenses, incomes, net: incomes - expenses };
}

export type BatchPayloadItem = {
  clientId: string;
  kind: BatchRowKind;
  name: string;
  categoryId: number;
  amount: number;
  walletId: number;
  date: string;
  isPaid?: boolean;
  isRecurring?: boolean;
  applyToBothFortnights?: boolean;
  applyWalletDelta?: boolean;
};

export function toBatchItems(
  rows: BatchRow[],
  wallets: PaymentMethodOption[],
): BatchPayloadItem[] {
  return rows.map((row) => {
    const base = {
      clientId: row.clientId,
      kind: row.kind,
      name: row.name.trim(),
      categoryId: row.categoryId,
      amount: Number(row.amount),
      walletId: row.walletId,
      date: row.date,
    };
    if (row.kind === 'income') return base;
    return {
      ...base,
      isPaid: effectiveIsPaid(row, wallets),
      isRecurring: row.isRecurring,
      applyToBothFortnights: row.isRecurring && row.applyToBothFortnights,
      ...(row.skipWalletDelta ? { applyWalletDelta: false } : {}),
    };
  });
}

/**
 * Drops rows the server saved and marks the rest failed with their error, so
 * only what still needs attention stays on screen.
 */
export function applyBatchResults(
  rows: BatchRow[],
  response: BatchResponse,
): BatchRow[] {
  const byId = new Map(response.results.map((r) => [r.clientId, r]));
  const next: BatchRow[] = [];
  for (const row of rows) {
    const result = byId.get(row.clientId);
    if (!result) {
      next.push({ ...row, status: 'draft' });
    } else if (result.status === 'failed') {
      next.push({ ...row, status: 'failed', error: result.error });
    }
  }
  return next;
}

export const BATCH_SOFT_LIMIT = 10;
