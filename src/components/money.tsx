import {
  formatMoney,
  MONEY_SIZE_CLASS,
  MONEY_TONE_CLASS,
  resolveMoneyTone,
  type MoneySize,
  type MoneyTone,
} from '@/lib/money';
import { cn, toDisplayAmount } from '@/lib/utils';

export type MoneyProps = {
  value: number | string;
  size?: MoneySize;
  /**
   * `auto` colors a negative amount as expense and a positive amount as income.
   * Pass `neutral` for balances that are not a gain or a loss.
   */
  tone?: MoneyTone;
  className?: string;
};

/**
 * The only amount figure. Sign comes from `formatMoney`, color from
 * `MONEY_TONE_CLASS`, weight from `size`.
 */
export const Money = ({
  value,
  size = 'row',
  tone = 'auto',
  className,
}: MoneyProps) => {
  const amount = toDisplayAmount(value);
  const resolved = resolveMoneyTone(amount, tone);

  return (
    <span className={cn(MONEY_SIZE_CLASS[size], MONEY_TONE_CLASS[resolved], className)}>
      {formatMoney(amount)}
    </span>
  );
};

export const Amount = Money;
