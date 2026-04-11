'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { WalletListItem } from '@/types/catalog';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, CreditCard, Landmark, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const WALLET_STRIP_VISIBLE_KEY = 'micasa.planificacion.walletStripVisible';


type WalletBalanceStripProps = {
  wallets: WalletListItem[];
  paidWalletIds?: number[];
};

const WalletBalanceStrip = ({ wallets, paidWalletIds = [] }: WalletBalanceStripProps) => {
  const { context } = useFinanceContext();
  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);
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
            className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted/60"
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

                const WalletIcon =
                  wallet.type === 'CREDIT_CARD' || wallet.type === 'DEPARTMENT_STORE_CARD'
                    ? CreditCard
                    : wallet.type === 'DEBIT_CARD'
                      ? Landmark
                      : Wallet;

                const cardContent = (
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1',
                        isCreditType
                          ? 'bg-violet-500/15 ring-violet-500/25 dark:bg-violet-500/20'
                          : wallet.type === 'DEBIT_CARD'
                            ? 'bg-blue-500/15 ring-blue-500/25 dark:bg-blue-500/20'
                            : 'bg-muted/50 ring-border/50',
                      )}
                    >
                      <WalletIcon
                        className={cn(
                          'h-3.5 w-3.5',
                          isCreditType
                            ? 'text-violet-500 dark:text-violet-400'
                            : wallet.type === 'DEBIT_CARD'
                              ? 'text-blue-500 dark:text-blue-400'
                              : 'text-muted-foreground',
                        )}
                      />
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
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all dark:from-emerald-400 dark:to-emerald-300"
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
                  'group shrink-0 rounded-xl border px-3 py-2',
                  'transition-all duration-200 hover:shadow-lg',
                  isCreditType
                    ? 'border-violet-500/25 bg-gradient-to-br from-violet-500/10 to-violet-500/5 dark:from-violet-500/15 dark:to-violet-500/8 cursor-pointer hover:border-violet-500/45 hover:shadow-violet-500/10'
                    : wallet.type === 'DEBIT_CARD'
                      ? 'border-blue-500/25 bg-gradient-to-br from-blue-500/10 to-blue-500/5 dark:from-blue-500/15 dark:to-blue-500/8'
                      : 'border-border/60 bg-card dark:bg-card/80',
                );

                if (isCreditType) {
                  return (
                    <Link
                      key={wallet.id}
                      href={`/credit-cards/${wallet.id}${ownerQueryString}`}
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
        <div className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
          {sortedWallets.map((wallet) => {
            const isCreditType =
              wallet.type === 'CREDIT_CARD' || wallet.type === 'DEPARTMENT_STORE_CARD';
            return (
              <div key={wallet.id} className="flex shrink-0 items-center gap-1.5">
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    isCreditType
                      ? 'bg-violet-500/60'
                      : wallet.type === 'DEBIT_CARD'
                        ? 'bg-blue-500/60'
                        : 'bg-muted-foreground/40',
                  )}
                  aria-hidden
                />
                <span className="max-w-[80px] truncate text-[10px] font-medium text-muted-foreground/80">
                  {wallet.name}
                </span>
                <span
                  className={cn(
                    'font-mono text-[10px] font-semibold tabular-nums',
                    wallet.amount < 0 ? 'text-destructive/80' : 'text-foreground/80',
                  )}
                >
                  {formatCurrency(wallet.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WalletBalanceStrip;
