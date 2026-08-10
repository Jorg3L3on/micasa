'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';
import { TrendingDown, TrendingUp } from 'lucide-react';

type WalletAmountTrendIndicatorProps = {
  diff: number;
  isPositive: boolean;
  label?: string;
  className?: string;
  previousAmount?: number;
  currentAmount?: number;
  onGradient?: boolean;
};

const calculatePercentageChange = (
  previousAmount: number,
  currentAmount: number,
): number | null => {
  if (previousAmount === 0) return null;
  return ((currentAmount - previousAmount) / Math.abs(previousAmount)) * 100;
};

export const WalletAmountTrendIndicator = ({
  diff,
  isPositive,
  label = 'vs mes anterior',
  className,
  previousAmount,
  currentAmount,
  onGradient = false,
}: WalletAmountTrendIndicatorProps) => {
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const iconColorClass = onGradient
    ? isPositive
      ? 'text-emerald-200/90'
      : 'text-rose-200/90'
    : isPositive
      ? 'text-green-600/70 dark:text-green-400/70'
      : 'text-red-600/70 dark:text-red-400/70';
  const amountColorClass = onGradient
    ? isPositive
      ? 'text-emerald-200'
      : 'text-rose-200'
    : isPositive
      ? 'text-green-700 dark:text-green-400'
      : 'text-red-600 dark:text-red-400';
  const labelColorClass = onGradient
    ? 'text-white/70'
    : 'text-muted-foreground';

  const percentageChange =
    previousAmount !== undefined && currentAmount !== undefined
      ? calculatePercentageChange(previousAmount, currentAmount)
      : null;

  const content = (
    <div
      className={cn(
        'flex max-w-full min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-sm',
        className,
      )}
    >
      <span
        className={cn(
          'shrink-0 font-mono text-xs font-medium tabular-nums',
          amountColorClass,
        )}
      >
        {diff >= 0 ? '+' : '−'}
        {formatCurrency(Math.abs(diff))}
      </span>
      <span className={cn('min-w-0 truncate', labelColorClass)}>{label}</span>
      <Icon className={cn('h-4 w-4 shrink-0', iconColorClass)} aria-hidden />
    </div>
  );

  if (percentageChange !== null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="max-w-full min-w-0 cursor-default">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {percentageChange >= 0 ? '+' : ''}
          {percentageChange.toFixed(1)}% {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};
