'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { WalletListItem } from '@/types/catalog';
import { formatCurrency, cn } from '@/lib/utils';
import { Banknote, ChevronDown, ChevronUp, CreditCard, Landmark, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const WALLET_STRIP_VISIBLE_KEY = 'micasa.planificacion.walletStripVisible';

type WalletTheme = {
  icon: LucideIcon;
  accent: string;
  border: string;
  iconBg: string;
};

const WALLET_THEMES: Record<string, WalletTheme> = {
  CASH: {
    icon: Banknote,
    accent: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-l-emerald-500/50',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
  },
  DEBIT_CARD: {
    icon: Landmark,
    accent: 'text-blue-600 dark:text-blue-400',
    border: 'border-l-blue-500/50',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/15',
  },
  CREDIT_CARD: {
    icon: CreditCard,
    accent: 'text-violet-600 dark:text-violet-400',
    border: 'border-l-violet-500/50',
    iconBg: 'bg-violet-500/10 dark:bg-violet-500/15',
  },
  DEPARTMENT_STORE_CARD: {
    icon: Store,
    accent: 'text-amber-600 dark:text-amber-400',
    border: 'border-l-amber-500/50',
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/15',
  },
};

const DEFAULT_THEME: WalletTheme = {
  icon: CreditCard,
  accent: 'text-muted-foreground',
  border: 'border-l-muted-foreground/40',
  iconBg: 'bg-muted/50',
};

type WalletBalanceStripProps = {
  wallets: WalletListItem[];
  paidWalletIds?: number[];
};

const WalletBalanceStrip = ({ wallets, paidWalletIds = [] }: WalletBalanceStripProps) => {
  const [stripVisible, setStripVisible] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WALLET_STRIP_VISIBLE_KEY);
      if (raw === 'false') setStripVisible(false);
      if (raw === 'true') setStripVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  const persistStripVisible = useCallback((visible: boolean) => {
    try {
      localStorage.setItem(WALLET_STRIP_VISIBLE_KEY, visible ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, []);

  const handleToggleStrip = useCallback(() => {
    setStripVisible((prev) => {
      const next = !prev;
      persistStripVisible(next);
      return next;
    });
  }, [persistStripVisible]);

  if (wallets.length === 0) return null;

  const priority: Record<string, number> = {
    CASH: 0,
    DEBIT_CARD: 1,
  };

  const sortedWallets = [...wallets].sort((a, b) => {
    const pa = priority[a.type] ?? 2;
    const pb = priority[b.type] ?? 2;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg"
            onClick={handleToggleStrip}
            aria-expanded={stripVisible}
            aria-label={
              stripVisible
                ? 'Ocultar tarjetas de saldos de billeteras'
                : 'Mostrar tarjetas de saldos de billeteras'
            }
          >
            {stripVisible ? (
              <ChevronUp className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4" aria-hidden />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          Mostrar u ocultar saldos de billeteras
        </TooltipContent>
      </Tooltip>

      {stripVisible ? (
        <div
          className="relative min-w-0 flex-1 overflow-hidden"
          role="region"
          aria-label="Saldos de billeteras"
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-linear-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-4 bg-linear-to-l from-background to-transparent" />

          <div className="overflow-x-auto scrollbar-hide px-2">
            <div className="flex gap-2 py-0.5">
              {sortedWallets.map((wallet) => {
                const theme = WALLET_THEMES[wallet.type] ?? DEFAULT_THEME;
                const Icon = theme.icon;

                const isCreditType =
                  wallet.type === 'CREDIT_CARD' ||
                  wallet.type === 'DEPARTMENT_STORE_CARD';

                const creditLimit = wallet.credit_limit ?? 0;
                const availableForCredit =
                  isCreditType && creditLimit > 0
                    ? Math.max(0, creditLimit - wallet.amount)
                    : null;

                const percentAvailable = (() => {
                  if (isCreditType) {
                    if (!creditLimit || creditLimit <= 0) return 0;
                    return Math.max(
                      0,
                      Math.min(100, (availableForCredit! / creditLimit) * 100),
                    );
                  }
                  return wallet.amount > 0 ? 100 : 0;
                })();

                const today = new Date();
                const currentDay = today.getDate();

                const isFirstFortnight = currentDay <= 15;
                const walletAlreadyPaid = paidWalletIds.includes(wallet.id);
                const dueInCurrentFortnight =
                  isCreditType &&
                  !walletAlreadyPaid &&
                  wallet.due_day != null &&
                  (isFirstFortnight
                    ? wallet.due_day >= 1 && wallet.due_day <= 15
                    : wallet.due_day >= 16);

                const isDueNear = (() => {
                  if (!dueInCurrentFortnight) return false;
                  const daysUntilDue = wallet.due_day! - currentDay;
                  return daysUntilDue >= 0 && daysUntilDue <= 5;
                })();

                const isDuePast = (() => {
                  if (!dueInCurrentFortnight) return false;
                  return wallet.due_day! < currentDay;
                })();

                const cardContent = (
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
                      {isCreditType && (
                        <div className="mt-1 space-y-0.5">
                          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                            <div
                              className="h-full rounded-full transition-all bg-emerald-500 dark:bg-emerald-400"
                              style={{ width: `${percentAvailable}%` }}
                              aria-hidden
                            />
                          </div>
                          {wallet.cutoff_day != null && wallet.due_day != null && (
                            <p className="text-[9px] text-muted-foreground leading-tight">
                              Corte {wallet.cutoff_day} ·{' '}
                              <span
                                className={cn(
                                  'font-semibold',
                                  (isDueNear || isDuePast) && 'text-destructive',
                                )}
                              >
                                Pago {wallet.due_day}
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );

                const cardClasses = cn(
                  'group shrink-0 rounded-lg border border-border/60 border-l-[3px] px-3 py-1.5',
                  'transition-shadow duration-200 hover:shadow-md',
                  'bg-card dark:bg-card/80',
                  theme.border,
                  isCreditType && 'cursor-pointer',
                );

                if (isCreditType) {
                  return (
                    <Link
                      key={wallet.id}
                      href={`/credit-cards/${wallet.id}`}
                      className={cardClasses}
                      aria-label={`Ver estado de cuenta de ${wallet.name}`}
                    >
                      {cardContent}
                    </Link>
                  );
                }

                return (
                  <div key={wallet.id} className={cardClasses}>
                    {cardContent}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground min-w-0 truncate text-xs tabular-nums">
          {sortedWallets.length} billetera
          {sortedWallets.length !== 1 ? 's' : ''} · pulsa la flecha para ver saldos
        </p>
      )}
    </div>
  );
};

export default WalletBalanceStrip;
