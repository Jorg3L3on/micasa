'use client';

import { useCallback, useMemo, useState } from 'react';
import type { WalletListItem } from '@/types/catalog';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery } from '@/lib/api/client-fetch';
import { getProviderCardStyle } from '@/lib/provider-card-style';
import { formatCurrency, cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, CreditCard, Landmark, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { WalletBalanceEditDialog } from '@/components/wallets/WalletBalanceEditDialog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';

const WALLET_STRIP_VISIBLE_KEY = 'micasa.planificacion.walletStripVisible';

type WalletBalanceStripProps = {
  wallets: WalletListItem[];
  paidWalletIds?: number[];
  /** Past/future monthly views must not use “today” due reminders */
  isCurrentMonth?: boolean;
  /** After saldo persists to the API (e.g. refetch resumen / billeteras vs pendiente). */
  onBalancesPersisted?: () => void;
};

const WalletBalanceStrip = ({
  wallets,
  paidWalletIds = [],
  isCurrentMonth = true,
  onBalancesPersisted,
}: WalletBalanceStripProps) => {
  const { context } = useFinanceContext();
  const [selectedWallet, setSelectedWallet] = useState<WalletListItem | null>(null);
  const [balanceOverrides, setBalanceOverrides] = useState<Record<number, number>>({});
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

  const getEffectiveAmount = (wallet: WalletListItem) =>
    balanceOverrides[wallet.id] ?? wallet.amount;

  const handleOpenWalletModal = useCallback((wallet: WalletListItem) => {
    const effectiveAmount = balanceOverrides[wallet.id] ?? wallet.amount;
    setSelectedWallet({ ...wallet, amount: effectiveAmount });
  }, [balanceOverrides]);

  const sortedWallets = [...wallets].sort((a, b) => {
    const getTypeRank = (type: string) => {
      if (type === 'CASH') return 0;
      if (type === 'DEBIT_CARD') return 1;
      if (type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD') return 2;
      return 3;
    };

    const rankDiff = getTypeRank(a.type) - getTypeRank(b.type);
    if (rankDiff !== 0) return rankDiff;

    const bothCreditTypes =
      (a.type === 'CREDIT_CARD' || a.type === 'DEPARTMENT_STORE_CARD') &&
      (b.type === 'CREDIT_CARD' || b.type === 'DEPARTMENT_STORE_CARD');

    if (bothCreditTypes) {
      const getUsedPct = (wallet: WalletListItem) => {
        const limit = Number(wallet.credit_limit ?? 0);
        if (limit <= 0) return Number.POSITIVE_INFINITY;
        return Math.max(0, Number(getEffectiveAmount(wallet))) / limit;
      };

      const usedPctDiff = getUsedPct(a) - getUsedPct(b);
      if (usedPctDiff !== 0) return usedPctDiff;
    }

    return a.name.localeCompare(b.name);
  });

  if (wallets.length === 0) return null;

  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      {stripVisible ? (
        <div
          className="relative min-w-0 flex-1 pt-0.5"
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
                const effectiveAmount = getEffectiveAmount(wallet);

                const creditLimit = wallet.credit_limit ?? 0;
                const percentUsed = (() => {
                  if (isCreditType) {
                    if (!creditLimit || creditLimit <= 0) return 0;
                    return Math.max(
                      0,
                      Math.min(100, (Math.max(0, effectiveAmount) / creditLimit) * 100),
                    );
                  }
                  return effectiveAmount > 0 ? 100 : 0;
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

                const showDueReminder =
                  isCurrentMonth &&
                  (isDueNear || isDuePast) &&
                  !walletAlreadyPaid;

                const WalletIcon =
                  wallet.type === 'CREDIT_CARD' || wallet.type === 'DEPARTMENT_STORE_CARD'
                    ? CreditCard
                    : wallet.type === 'DEBIT_CARD'
                      ? Landmark
                      : Wallet;

                const isFunding =
                  wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD';
                const fallbackAccent =
                  isCreditType
                    ? 'violet'
                    : wallet.type === 'DEBIT_CARD'
                      ? 'blue'
                      : wallet.type === 'CASH'
                        ? 'emerald'
                        : 'neutral';

                const hasBankIcon = Boolean(wallet.provider_icon_key);
                const providerCardStyle = getProviderCardStyle(
                  wallet.provider_icon_key,
                  wallet.type,
                  'calm',
                );
                const useProviderGradient = Boolean(providerCardStyle);
                const accent = hasBankIcon ? 'neutral' : fallbackAccent;

                const cardContent = (
                  <div className="flex items-start gap-1.5">
                    {hasBankIcon ? (
                      <span className="relative mt-0.5 shrink-0">
                        <span
                          className={cn(
                            'absolute inset-0 rounded-md',
                            useProviderGradient
                              ? 'bg-white/88 dark:bg-white/92'
                              : 'bg-card/95 dark:bg-card/90',
                          )}
                          aria-hidden
                        />
                        <WalletProviderIcon
                          providerIconKey={wallet.provider_icon_key}
                          className={cn(
                            'relative h-7 w-7 rounded-md shadow-sm ring-1',
                            useProviderGradient
                              ? 'ring-white/45'
                              : 'ring-border/60',
                          )}
                          iconClassName="h-3.5 w-3.5"
                          showTooltipLabel={false}
                        />
                        {showDueReminder && (
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
                    ) : (
                      <span
                        className={cn(
                          'relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 shadow-sm',
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
                            'h-3 w-3',
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
                        {showDueReminder && (
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
                    )}
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p
                        className={cn(
                          'truncate text-[9.5px] font-semibold leading-tight',
                          useProviderGradient
                            ? 'text-white/85'
                            : 'text-muted-foreground/90',
                        )}
                      >
                        {wallet.name}
                      </p>
                      <p
                        className={cn(
                          'font-mono text-[13px] font-black tabular-nums leading-none sm:text-sm',
                          effectiveAmount < 0
                            ? useProviderGradient
                              ? 'text-red-100'
                              : 'text-destructive'
                            : useProviderGradient
                              ? 'text-white'
                              : 'text-foreground',
                        )}
                      >
                        {formatCurrency(effectiveAmount)}
                      </p>
                      {isCreditType && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div
                            className={cn(
                              'relative h-1 w-10 overflow-hidden rounded-full sm:w-12',
                              useProviderGradient ? 'bg-white/25' : 'bg-muted/50',
                            )}
                          >
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                useProviderGradient
                                  ? 'bg-white/85'
                                  : 'bg-gradient-to-r from-emerald-500 to-emerald-400 dark:from-emerald-400 dark:to-emerald-300',
                              )}
                              style={{ width: `${percentUsed}%` }}
                              aria-hidden
                            />
                          </div>
                          {wallet.due_day != null && (
                            <span
                              className={cn(
                                'whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none tabular-nums',
                                walletAlreadyPaid
                                  ? useProviderGradient
                                    ? 'bg-emerald-500/25 text-emerald-50'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                  : !isCurrentMonth
                                    ? useProviderGradient
                                      ? 'text-white/75'
                                      : 'text-muted-foreground/70'
                                    : isDuePast
                                      ? useProviderGradient
                                        ? 'text-red-100'
                                        : 'text-destructive'
                                      : isDueNear
                                        ? useProviderGradient
                                          ? 'text-amber-100'
                                          : 'text-amber-600 dark:text-amber-400'
                                        : useProviderGradient
                                          ? 'text-white/75'
                                          : 'text-muted-foreground/70',
                              )}
                            >
                              {walletAlreadyPaid ? 'pagada' : `Paga ${wallet.due_day}`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );

                const cardClasses = cn(
                  'group relative min-w-[136px] shrink-0 overflow-hidden rounded-xl border px-2 py-1.5 sm:min-w-[164px] sm:px-2.5 sm:py-2',
                  'backdrop-blur-sm ring-1 ring-inset ring-white/5 transition-all duration-300',
                  // subtle inner gloss highlight
                  'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent dark:before:via-white/10',
                  // faint diagonal sheen for premium finish
                  'after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(120deg,transparent_25%,rgba(255,255,255,0.12)_48%,transparent_72%)] after:opacity-45 after:transition-opacity after:duration-300',
                  accent === 'violet' &&
                    'border-violet-500/30 bg-gradient-to-br from-violet-500/12 via-background to-violet-500/4 dark:from-violet-500/20 dark:via-card dark:to-violet-500/5',
                  accent === 'blue' &&
                    'border-blue-500/30 bg-gradient-to-br from-blue-500/12 via-background to-blue-500/4 dark:from-blue-500/20 dark:via-card dark:to-blue-500/5',
                  accent === 'emerald' &&
                    'border-emerald-500/30 bg-gradient-to-br from-emerald-500/12 via-background to-emerald-500/4 dark:from-emerald-500/20 dark:via-card dark:to-emerald-500/5',
                  accent === 'neutral' && 'border-border/60 bg-card dark:bg-card/80',
                  (isCreditType || isFunding) &&
                    cn(
                      'cursor-pointer hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-lg',
                      useProviderGradient &&
                        'border-white/25 shadow-[0_10px_24px_-14px_rgba(15,23,42,0.9)] hover:border-white/40 hover:shadow-[0_16px_34px_-14px_rgba(15,23,42,0.95)] hover:after:opacity-70',
                      !useProviderGradient &&
                        accent === 'violet' &&
                        'hover:border-violet-500/60 hover:shadow-violet-500/15',
                      !useProviderGradient &&
                        accent === 'blue' &&
                        'hover:border-blue-500/60 hover:shadow-blue-500/15',
                      !useProviderGradient &&
                        accent === 'emerald' &&
                        'hover:border-emerald-500/60 hover:shadow-emerald-500/15',
                      !useProviderGradient &&
                        accent === 'neutral' &&
                        'hover:border-border',
                    ),
                );

                return (
                  <button
                    key={wallet.id}
                    type="button"
                    onClick={() => handleOpenWalletModal(wallet)}
                    className={cardClasses}
                    style={providerCardStyle}
                    aria-label={`Abrir detalles de ${wallet.name}`}
                  >
                    {useProviderGradient ? (
                      <>
                        <span className="pointer-events-none absolute -left-8 -top-10 h-20 w-20 rounded-full bg-white/8 blur-2xl" />
                        <span className="pointer-events-none absolute -right-8 -bottom-10 h-20 w-20 rounded-full bg-black/20 blur-2xl" />
                      </>
                    ) : null}
                    {cardContent}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex min-w-max items-center gap-2.5 py-0.5 pr-1">
              {sortedWallets.map((wallet) => {
                const isCreditType =
                  wallet.type === 'CREDIT_CARD' || wallet.type === 'DEPARTMENT_STORE_CARD';
                return (
                  <div key={wallet.id} className="flex shrink-0 items-center gap-1.5">
                    {wallet.provider_icon_key ? (
                      <WalletProviderIcon
                        providerIconKey={wallet.provider_icon_key}
                        className="h-5 w-5 rounded-md shadow-sm ring-1 ring-border/50"
                        iconClassName="h-3 w-3"
                        showTooltipLabel={false}
                      />
                    ) : (
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
                    )}
                    <span className="max-w-[80px] truncate text-[10px] font-medium text-muted-foreground/80">
                      {wallet.name}
                    </span>
                    <span
                      className={cn(
                        'font-mono text-[10px] font-semibold tabular-nums',
                        wallet.amount < 0 ? 'text-destructive/80' : 'text-foreground/80',
                      )}
                    >
                      {formatCurrency(getEffectiveAmount(wallet))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

      <WalletBalanceEditDialog
        wallet={selectedWallet}
        ownerQueryString={ownerQueryString}
        onOpenChange={(open) => {
          if (!open) setSelectedWallet(null);
        }}
        onSaved={(walletId, newAmount) => {
          setBalanceOverrides((prev) => ({ ...prev, [walletId]: newAmount }));
          setSelectedWallet((prev) =>
            prev && prev.id === walletId ? { ...prev, amount: newAmount } : prev,
          );
          onBalancesPersisted?.();
        }}
      />
    </div>
  );
};

export default WalletBalanceStrip;
