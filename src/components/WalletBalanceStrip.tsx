'use client';

import { useCallback, useMemo, useState } from 'react';
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
  const [stripVisible, setStripVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = window.localStorage.getItem(WALLET_STRIP_VISIBLE_KEY);
      if (raw === 'false') return false;
      if (raw === 'true') return true;
    } catch {
      /* ignore */
    }
    return true;
  });

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
    <div className="grid min-w-0 flex-1 grid-cols-[auto,minmax(0,1fr)] items-start gap-2">
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
          className="relative min-w-0 pt-0.5"
          role="region"
          aria-label="Saldos de billeteras"
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-3 bg-linear-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-3 bg-linear-to-l from-background to-transparent" />

          <div className="overflow-x-auto scrollbar-hide px-1">
            <div className="flex gap-2 py-0.5 pr-1">
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

                const isFunding =
                  wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD';
                const accent =
                  isCreditType
                    ? 'violet'
                    : wallet.type === 'DEBIT_CARD'
                      ? 'blue'
                      : wallet.type === 'CASH'
                        ? 'emerald'
                        : 'neutral';

                const cardContent = (
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 shadow-sm',
                        accent === 'violet' &&
                          'bg-gradient-to-br from-violet-500/25 to-violet-600/10 ring-violet-500/30 dark:from-violet-400/25 dark:to-violet-500/10',
                        accent === 'blue' &&
                          'bg-gradient-to-br from-blue-500/25 to-blue-600/10 ring-blue-500/30 dark:from-blue-400/25 dark:to-blue-500/10',
                        accent === 'emerald' &&
                          'bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 ring-emerald-500/30 dark:from-emerald-400/25 dark:to-emerald-500/10',
                        accent === 'neutral' &&
                          'bg-muted/60 ring-border/60',
                      )}
                    >
                      <WalletIcon
                        className={cn(
                          'h-4 w-4',
                          accent === 'violet' &&
                            'text-violet-600 dark:text-violet-300',
                          accent === 'blue' &&
                            'text-blue-600 dark:text-blue-300',
                          accent === 'emerald' &&
                            'text-emerald-600 dark:text-emerald-300',
                          accent === 'neutral' && 'text-muted-foreground',
                        )}
                        aria-hidden
                      />
                      {(isDueNear || isDuePast) && (
                        <span
                          className={cn(
                            'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background',
                            isDuePast
                              ? 'bg-destructive animate-pulse'
                              : 'bg-amber-500',
                          )}
                          aria-hidden
                        />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="max-w-[130px] truncate text-[11px] font-semibold leading-tight text-muted-foreground/90">
                        {wallet.name}
                      </p>
                      <p
                        className={cn(
                          'font-mono text-base font-black tabular-nums leading-none',
                          wallet.amount < 0
                            ? 'text-destructive'
                            : 'text-foreground',
                        )}
                      >
                        {formatCurrency(wallet.amount)}
                      </p>
                      {isCreditType && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="relative h-1 w-14 overflow-hidden rounded-full bg-muted/50 sm:w-16">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all dark:from-emerald-400 dark:to-emerald-300"
                              style={{ width: `${percentAvailable}%` }}
                              aria-hidden
                            />
                          </div>
                          {wallet.due_day != null && (
                            <span
                              className={cn(
                                'whitespace-nowrap text-[9px] font-semibold leading-none tabular-nums',
                                isDuePast
                                  ? 'text-destructive'
                                  : isDueNear
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-muted-foreground/70',
                              )}
                            >
                              Paga {wallet.due_day}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );

                const cardClasses = cn(
                  'group relative min-w-[178px] shrink-0 overflow-hidden rounded-2xl border px-3 py-2.5 sm:min-w-[210px] sm:px-3.5',
                  'backdrop-blur-sm transition-all duration-200',
                  // subtle inner gloss highlight
                  'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent dark:before:via-white/10',
                  accent === 'violet' &&
                    'border-violet-500/30 bg-gradient-to-br from-violet-500/12 via-background to-violet-500/4 dark:from-violet-500/20 dark:via-card dark:to-violet-500/5',
                  accent === 'blue' &&
                    'border-blue-500/30 bg-gradient-to-br from-blue-500/12 via-background to-blue-500/4 dark:from-blue-500/20 dark:via-card dark:to-blue-500/5',
                  accent === 'emerald' &&
                    'border-emerald-500/30 bg-gradient-to-br from-emerald-500/12 via-background to-emerald-500/4 dark:from-emerald-500/20 dark:via-card dark:to-emerald-500/5',
                  accent === 'neutral' && 'border-border/60 bg-card dark:bg-card/80',
                  (isCreditType || isFunding) &&
                    cn(
                      'cursor-pointer hover:-translate-y-0.5 hover:shadow-lg',
                      accent === 'violet' &&
                        'hover:border-violet-500/60 hover:shadow-violet-500/15',
                      accent === 'blue' &&
                        'hover:border-blue-500/60 hover:shadow-blue-500/15',
                      accent === 'emerald' &&
                        'hover:border-emerald-500/60 hover:shadow-emerald-500/15',
                      accent === 'neutral' && 'hover:border-border',
                    ),
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

                if (isFunding) {
                  return (
                    <Link
                      key={wallet.id}
                      href={`/wallets/${wallet.id}${ownerQueryString}`}
                      className={cardClasses}
                      aria-label={`Ver movimientos de ${wallet.name}`}
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
        <div className="min-w-0 pt-0.5">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex min-w-max items-center gap-2.5 py-0.5 pr-1">
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
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletBalanceStrip;
