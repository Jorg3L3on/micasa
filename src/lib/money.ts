import { formatCurrency, toDisplayAmount } from '@/lib/utils';

/**
 * Sign, color, and weight for every amount.
 * JOR-310 replaces `MONEY_TONE_CLASS` with semantic status tokens;
 * callers should not invent a second palette.
 */

export type MoneySize = 'hero' | 'row' | 'caption';

/** Explicit tone. `auto` follows the sign of the value. */
export type MoneyTone = 'auto' | 'neutral' | 'positive' | 'negative';

export type ResolvedMoneyTone = Exclude<MoneyTone, 'auto'>;

/**
 * One mapping from tone to semantic status tokens (JOR-310).
 * Positive money is income; negative money is expense.
 */
export const MONEY_TONE_CLASS: Record<ResolvedMoneyTone, string> = {
  neutral: 'text-foreground',
  positive: 'text-status-income',
  negative: 'text-status-expense',
};

/** Weight and size. Sans + tabular figures — never the mono face. */
export const MONEY_SIZE_CLASS: Record<MoneySize, string> = {
  hero: 'font-sans text-2xl font-bold tabular-nums tracking-tight sm:text-3xl',
  row: 'shrink-0 whitespace-nowrap font-sans text-sm font-semibold tabular-nums',
  caption: 'font-sans text-caption font-medium tabular-nums',
};

export const MONEY_FONT_CLASS = 'font-sans tabular-nums';

export const resolveMoneyTone = (
  amount: number,
  tone: MoneyTone = 'auto',
): ResolvedMoneyTone => {
  if (tone !== 'auto') return tone;
  if (amount < 0) return 'negative';
  if (amount > 0) return 'positive';
  return 'neutral';
};

/**
 * Single sign convention: es-MX currency from `Intl`.
 * Negatives render as `-$12.50` (ASCII hyphen). Do not prefix a second minus.
 */
export const formatMoney = (amount: number | string): string =>
  formatCurrency(toDisplayAmount(amount));

/**
 * Chart axis labels. One rule for every chart (JOR-315 should keep this helper):
 * `$` prefix, `k` from 1,000, `M` from 1,000,000, one decimal only below 10 of that unit.
 */
export const formatAxisMoney = (value: number): string => {
  if (!Number.isFinite(value)) return '';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const compact = (unit: number, suffix: string) => {
    const digits = unit >= 10 ? 0 : 1;
    const text = unit.toFixed(digits).replace(/\.0$/, '');
    return `${sign}$${text}${suffix}`;
  };
  if (abs >= 1_000_000) return compact(abs / 1_000_000, 'M');
  if (abs >= 1_000) return compact(abs / 1_000, 'k');
  return `${sign}$${Math.round(abs)}`;
};
