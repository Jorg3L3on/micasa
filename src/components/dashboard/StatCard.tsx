'use client';

import {
  Banknote,
  CreditCard,
  CircleDollarSign,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

const ICON_MAP = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'circle-dollar': CircleDollarSign,
  banknote: Banknote,
  scale: Scale,
  'credit-card': CreditCard,
} as const;

type IconKey = keyof typeof ICON_MAP;

type StatCardProps = {
  title: string;
  amount: number;
  iconKey: IconKey;
  iconGradient: string;
  subtitle?: string;
  className?: string;
};

export default function StatCard({
  title,
  amount,
  iconKey,
  iconGradient,
  subtitle,
  className,
}: StatCardProps) {
  const Icon = ICON_MAP[iconKey];

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card p-4 flex flex-col gap-3 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
          style={{ background: iconGradient }}
        >
          <Icon className="h-4 w-4 text-white" />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span
          className={cn(
            'text-2xl font-bold font-mono tabular-nums tracking-tight',
            amount < 0 ? 'text-destructive' : 'text-foreground',
          )}
        >
          {formatCurrency(amount)}
        </span>
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
      </div>
    </div>
  );
}
