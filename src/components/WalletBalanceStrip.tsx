import type { WalletListItem } from '@/types/catalog';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Banknote, CreditCard, Landmark, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type WalletTheme = {
  icon: LucideIcon;
  accent: string;
  bg: string;
  border: string;
  iconBg: string;
};

const WALLET_THEMES: Record<string, WalletTheme> = {
  CASH: {
    icon: Banknote,
    accent: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/5 dark:bg-emerald-500/10',
    border: 'border-l-emerald-500/50',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
  },
  DEBIT_CARD: {
    icon: Landmark,
    accent: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/5 dark:bg-blue-500/10',
    border: 'border-l-blue-500/50',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/15',
  },
  CREDIT_CARD: {
    icon: CreditCard,
    accent: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-500/5 dark:bg-violet-500/10',
    border: 'border-l-violet-500/50',
    iconBg: 'bg-violet-500/10 dark:bg-violet-500/15',
  },
  DEPARTMENT_STORE_CARD: {
    icon: Store,
    accent: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/5 dark:bg-amber-500/10',
    border: 'border-l-amber-500/50',
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
  },
};

const DEFAULT_THEME: WalletTheme = {
  icon: CreditCard,
  accent: 'text-muted-foreground',
  bg: 'bg-muted/30',
  border: 'border-l-muted-foreground/40',
  iconBg: 'bg-muted/50',
};

type WalletBalanceStripProps = {
  wallets: WalletListItem[];
};

const WalletBalanceStrip = ({ wallets }: WalletBalanceStripProps) => {
  if (wallets.length === 0) return null;

  return (
    <div
      className="relative flex-1 min-w-0"
      role="region"
      aria-label="Saldos de billeteras"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-linear-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-linear-to-l from-background to-transparent" />

      <div className="overflow-x-auto scrollbar-hide px-2">
        <div className="flex gap-2 py-0.5">
          {wallets.map((wallet) => {
            const theme = WALLET_THEMES[wallet.type] ?? DEFAULT_THEME;
            const Icon = theme.icon;

            return (
              <div
                key={wallet.id}
                className={cn(
                  'group shrink-0 rounded-lg border border-l-[3px] px-3 py-1.5',
                  'transition-shadow duration-200 hover:shadow-md',
                  'bg-card dark:bg-card/80',
                  theme.border,
                  theme.bg,
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-md shrink-0',
                      theme.iconBg,
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', theme.accent)} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate max-w-[100px] leading-none mb-0.5">
                      {wallet.name}
                    </p>
                    <p
                      className={cn(
                        'text-sm font-bold font-mono tabular-nums leading-none',
                        wallet.amount < 0
                          ? 'text-destructive'
                          : 'text-foreground',
                      )}
                    >
                      {formatCurrency(wallet.amount)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WalletBalanceStrip;
