import { formatCurrency } from '@/lib/utils';

/**
 * Step a money amount's font size down as its formatted string grows, so a
 * 7-digit amount fits a half-width phone tile without truncating digits.
 * 0: up to "$12,345.67" · 1: up to "-$123,456.78" · 2: anything longer.
 */
export const getAmountLengthTier = (amount: number): 0 | 1 | 2 => {
  const length = formatCurrency(amount).length;
  if (length <= 10) return 0;
  if (length <= 12) return 1;
  return 2;
};

/** Picks the class for `amount` from three sizes, shortest amount first. */
export const pickAmountSizeClass = (
  amount: number,
  sizes: readonly [string, string, string],
): string => sizes[getAmountLengthTier(amount)];
