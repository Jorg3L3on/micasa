import { formatDisplayDate } from '@/lib/calendar-dates';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | Date): string {
  return formatDisplayDate(dateString);
}

/** Coerces API amount (number, string, or Decimal-like) to a finite number for display. */
export function toDisplayAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (
    typeof value === 'object' &&
    value != null &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number.isFinite(numAmount) ? numAmount : 0);
}

export function formatCurrencySigned(
  amount: number | string,
  type: 'income' | 'expense',
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const signedAmount =
    type === 'expense' ? -Math.abs(numAmount) : Math.abs(numAmount);
  return formatCurrency(signedAmount);
}

export function formatMonth(month: number): string {
  return new Date(0, month - 1).toLocaleString('es-MX', { month: 'long' });
}

export function formatYear(year: number): string {
  return year.toString();
}

export function formatPeriod(period: 'FIRST' | 'SECOND'): string {
  return period === 'FIRST' ? 'Primera' : 'Segunda';
}
