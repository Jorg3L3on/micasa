import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | Date): string {
  try {
    const date =
      typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateString);
  }
}

export function formatCurrency(amount: number | string): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(numAmount);
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
