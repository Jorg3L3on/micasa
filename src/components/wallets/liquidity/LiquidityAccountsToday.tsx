'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, ExternalLink, Pencil } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  emptyLiquidityDebtBreakdown,
  fetchLiquidityDebtBreakdown,
} from '@/lib/api/liquidity';
import { listLoans } from '@/lib/api/loans';
import { accountHasDebtWhy } from '@/lib/finance/liquidity-debt-breakdown';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import { cn, formatCurrency } from '@/lib/utils';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { LiquidityAccountDebtWhy } from '@/components/wallets/liquidity/LiquidityAccountDebtWhy';
import { LiquidityDebtSummaryStrip } from '@/components/wallets/liquidity/LiquidityDebtSummaryStrip';
import { LiquiditySectionHeader } from '@/components/wallets/liquidity/liquidity-section';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  buildAccountsToday,
  toAccountTodayView,
  type AccountTodayBadge,
  type AccountTodayRow,
  type AccountTodayView,
} from '@/components/wallets/liquidity/liquidity-accounts-today';
import type { DebtAccountBreakdown, LiquidityDebtBreakdown, WalletListItem } from '@/types/catalog';
import type { LoanListItem } from '@/types/loans';

type LiquidityAccountsTodayProps = {
  onChanged?: () => void;
  actions?: ReactNode;
  fundingTotal?: number;
  sectionIcon?: LucideIcon;
};

const badgeToneClass = (tone: AccountTodayBadge['tone']): string =>
  cn(
    'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
    tone === 'destructive' && 'bg-destructive/10 text-destructive ring-destructive/20',
    tone === 'amber' &&
      'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-300',
    tone === 'emerald' &&
      'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
    tone === 'muted' && 'bg-muted text-muted-foreground ring-border/40',
  );

const utilizationBarClass = (utilizationPct: number): string =>
  cn(
    'h-full rounded-full transition-all',
    utilizationPct > 80
      ? 'bg-destructive/80'
      : utilizationPct > 50
        ? 'bg-amber-500/80'
        : 'bg-emerald-500/80',
  );

const AccountIcon = ({ view }: { view: AccountTodayView }) => {
  if (view.isFonacot && !view.providerIconKey) {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-[10px] font-bold tracking-wide text-teal-800 ring-1 ring-teal-500/30 dark:text-teal-200"
        aria-label="Fonacot"
        title="Fonacot"
      >
        FC
      </span>
    );
  }

  return (
    <WalletProviderIcon
      providerIconKey={view.providerIconKey}
      className="h-9 w-9 shrink-0 rounded-lg border border-border/60 bg-card"
      iconClassName="h-5 w-5"
    />
  );
};

const UtilizationBar = ({
  utilizationPct,
  className,
}: {
  utilizationPct: number;
  className?: string;
}) => (
  <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted/50', className)}>
    <div
      className={utilizationBarClass(utilizationPct)}
      style={{ width: `${utilizationPct}%` }}
    />
  </div>
);

const debtToneClass = (view: AccountTodayView): string =>
  view.kind === 'loan'
    ? 'text-amber-300'
    : view.figures.isCredit
      ? 'text-violet-300'
      : 'text-muted-foreground';

const breakdownKeyForRow = (row: AccountTodayRow): string =>
  row.kind === 'wallet' ? `wallet-${row.wallet.id}` : `loan-${row.loan.id}`;

const IconTipButton = ({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="h-8 w-8 shrink-0 text-muted-foreground"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
      >
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={4}>
      {label}
    </TooltipContent>
  </Tooltip>
);

const AccountCard = ({
  view,
  preview,
  hasWhy,
  onSelect,
  onEdit,
}: {
  view: AccountTodayView;
  preview: string;
  hasWhy: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) => {
  const { figures, badge } = view;
  const { debt, free, utilizationPct } = figures;

  return (
    <div
      className={cn(
        'relative flex w-[min(100%,17.5rem)] shrink-0 snap-start flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-3 text-left',
        'dark:border-white/[0.08] dark:bg-[#0a1020]/80',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-col gap-3 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={
          hasWhy
            ? `Ver por qué debes en ${view.name}`
            : view.kind === 'loan'
              ? `Ver ${view.name} en préstamos`
              : `Ver o editar ${view.name}`
        }
      >
        <div className="flex items-start gap-2.5">
          <AccountIcon view={view} />
          <div className="min-w-0 flex-1 pr-8">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-sm font-medium">{view.name}</p>
              {badge ? <span className={badgeToneClass(badge.tone)}>{badge.label}</span> : null}
            </div>
            <p className="text-[10px] text-muted-foreground">{view.typeLabel}</p>
            {preview ? (
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{preview}</p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Deuda
            </p>
            <p className={cn('font-mono text-sm font-bold tabular-nums', debtToneClass(view))}>
              {debt == null ? '—' : formatCurrency(debt)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Libre
            </p>
            <p
              className={cn(
                'font-mono text-sm font-bold tabular-nums',
                free == null ? 'text-muted-foreground' : 'text-emerald-300',
              )}
            >
              {free == null ? '—' : formatCurrency(free)}
            </p>
          </div>
        </div>

        {utilizationPct != null ? <UtilizationBar utilizationPct={utilizationPct} /> : null}
      </button>

      <div className="absolute right-2 top-2">
        <IconTipButton
          label={view.kind === 'loan' ? 'Abrir préstamo' : 'Corregir saldo'}
          onClick={onEdit}
        >
          {view.kind === 'loan' ? (
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          )}
        </IconTipButton>
      </div>
    </div>
  );
};

export const LiquidityAccountsToday = ({
  onChanged,
  actions,
  fundingTotal,
  sectionIcon: SectionIcon,
}: LiquidityAccountsTodayProps) => {
  const { context } = useFinanceContext();
  const router = useRouter();
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [loans, setLoans] = useState<LoanListItem[]>([]);
  const [breakdown, setBreakdown] = useState<LiquidityDebtBreakdown>(
    emptyLiquidityDebtBreakdown(),
  );
  const [breakdownError, setBreakdownError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<WalletListItem | null>(null);
  const [openWhyIds, setOpenWhyIds] = useState<string[]>([]);
  const [mobileWhyId, setMobileWhyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      const [walletResult, loanResult, breakdownResult] = await Promise.allSettled([
        clientFetchFromApi<WalletListItem[]>('/api/wallets', undefined, context),
        listLoans(context),
        fetchLiquidityDebtBreakdown(context),
      ]);
      setWallets(
        walletResult.status === 'fulfilled' && Array.isArray(walletResult.value)
          ? walletResult.value
          : [],
      );
      setLoans(
        loanResult.status === 'fulfilled' && Array.isArray(loanResult.value)
          ? loanResult.value
          : [],
      );
      if (breakdownResult.status === 'fulfilled') {
        setBreakdown(breakdownResult.value);
        setBreakdownError(false);
      } else {
        setBreakdown(emptyLiquidityDebtBreakdown());
        setBreakdownError(true);
      }
    } catch {
      setWallets([]);
      setLoans([]);
      setBreakdown(emptyLiquidityDebtBreakdown());
      setBreakdownError(true);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => buildAccountsToday(wallets, loans), [loans, wallets]);
  const views = useMemo(() => rows.map(toAccountTodayView), [rows]);
  const walletCount = rows.filter((row) => row.kind === 'wallet').length;
  const loanCount = rows.filter((row) => row.kind === 'loan').length;
  const breakdownById = useMemo(() => {
    const map = new Map<string, DebtAccountBreakdown>();
    for (const account of breakdown.accounts) {
      map.set(account.id, account);
    }
    return map;
  }, [breakdown.accounts]);

  const getBreakdown = (row: AccountTodayRow): DebtAccountBreakdown | undefined =>
    breakdownById.get(breakdownKeyForRow(row));

  const handleEditWallet = (wallet: WalletListItem) => {
    setSelectedCard(wallet);
  };

  const handleOpenLoan = (loanId: number) => {
    const params = buildOwnerQuery(context);
    params.set('loanId', String(loanId));
    router.push(`/loans?${params.toString()}`);
  };

  const handleOpenCard = (walletId: number) => {
    const params = buildOwnerQuery(context);
    router.push(`/credit-cards/${walletId}?${params.toString()}`);
  };

  const handleEditOrOpen = (row: AccountTodayRow) => {
    if (row.kind === 'wallet') {
      handleEditWallet(row.wallet);
      return;
    }
    handleOpenLoan(row.loan.id);
  };

  const handleWhyMore = (account: DebtAccountBreakdown) => {
    if (account.kind === 'loan') {
      handleOpenLoan(account.accountId);
      return;
    }
    handleOpenCard(account.accountId);
  };

  const handleMobileSelect = (row: AccountTodayRow) => {
    const account = getBreakdown(row);
    if (accountHasDebtWhy(account)) {
      setMobileWhyId(account!.id);
      return;
    }
    handleEditOrOpen(row);
  };

  const handleWhyOpenChange = (id: string, open: boolean) => {
    setOpenWhyIds((current) => {
      if (open) return current.includes(id) ? current : [...current, id];
      return current.filter((item) => item !== id);
    });
  };

  const mobileWhyAccount = mobileWhyId
    ? breakdownById.get(mobileWhyId) ?? null
    : null;
  const mobileWhyRow = mobileWhyAccount
    ? rows.find((row) => breakdownKeyForRow(row) === mobileWhyAccount.id) ?? null
    : null;

  const countLabel =
    loanCount > 0
      ? `${walletCount} cuenta${walletCount === 1 ? '' : 's'} · ${loanCount} préstamo${loanCount === 1 ? '' : 's'}`
      : `${walletCount} cuenta${walletCount === 1 ? '' : 's'}`;

  const description =
    fundingTotal != null ? (
      <>
        Hoy tienes{' '}
        <span className="font-mono font-semibold tabular-nums text-emerald-300">
          {formatCurrency(fundingTotal)}
        </span>{' '}
        en efectivo y débito. Toca una deuda para ver de qué está hecha.
      </>
    ) : (
      'Deuda y lo que te queda libre ahora. Toca una deuda para ver de qué está hecha.'
    );

  return (
    <>
      {SectionIcon ? (
        <LiquiditySectionHeader
          id="liquidity-cards-today-heading"
          title="Tus tarjetas y préstamos hoy"
          description={description}
          icon={SectionIcon}
          accent="emerald"
          actions={
            <>
              {actions}
              <span className="text-xs tabular-nums text-muted-foreground">{countLabel}</span>
            </>
          }
        />
      ) : null}

      <section
        className={cn(MONTHLY_PANEL_SHELL_CLASS, 'overflow-hidden')}
        aria-labelledby={SectionIcon ? undefined : 'liquidity-cards-today-heading'}
      >
        {!SectionIcon ? (
          <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <h2
                id="liquidity-cards-today-heading"
                className="text-base font-semibold leading-tight"
              >
                Tus tarjetas y préstamos hoy
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <span className="text-xs tabular-nums text-muted-foreground">{countLabel}</span>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3 px-4 py-4 sm:px-5" aria-hidden>
            <div className="h-28 animate-pulse rounded-xl bg-muted/40 sm:hidden" />
            <div className="hidden space-y-3 sm:block">
              <div className="h-12 animate-pulse rounded-xl bg-muted/40" />
              <div className="h-12 animate-pulse rounded-xl bg-muted/40" />
            </div>
          </div>
        ) : views.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
            No hay cuentas activas de efectivo, tarjeta o préstamo.
          </p>
        ) : (
          <>
            <LiquidityDebtSummaryStrip
              breakdown={breakdown}
              error={breakdownError}
              onRetry={() => {
                void load();
              }}
              className="mx-4 mb-3 sm:mx-5"
            />

            <div className="relative sm:hidden">
              <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide snap-x snap-mandatory">
                {views.map((view, index) => {
                  const row = rows[index]!;
                  const account = getBreakdown(row);
                  return (
                    <AccountCard
                      key={view.key}
                      view={view}
                      preview={account?.preview ?? ''}
                      hasWhy={accountHasDebtWhy(account)}
                      onSelect={() => handleMobileSelect(row)}
                      onEdit={() => handleEditOrOpen(row)}
                    />
                  );
                })}
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent dark:from-[#0d1327]"
                aria-hidden
              />
            </div>

            <div className="hidden sm:block">
              <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(7rem,1fr)_minmax(7rem,1fr)] gap-3 border-t border-border/40 px-5 py-2 pr-24">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cuenta
                </p>
                <p className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Deuda
                </p>
                <p className="text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Libre
                </p>
              </div>

              <ul className="divide-y divide-border/40">
                {views.map((view, index) => {
                  const row = rows[index]!;
                  const account = getBreakdown(row);
                  const hasWhy = accountHasDebtWhy(account);
                  const { figures, badge } = view;
                  const { debt, free, utilizationPct } = figures;
                  const showLoanHeading =
                    view.kind === 'loan' && (index === 0 || views[index - 1]?.kind !== 'loan');
                  const whyId = account?.id ?? breakdownKeyForRow(row);
                  const isOpen = openWhyIds.includes(whyId);

                  const figuresRow = (
                    <>
                      <p
                        className={cn(
                          'font-mono text-sm font-bold tabular-nums sm:text-right',
                          debtToneClass(view),
                        )}
                      >
                        {debt == null ? '—' : formatCurrency(debt)}
                      </p>
                      <p
                        className={cn(
                          'font-mono text-sm font-bold tabular-nums sm:text-right',
                          free == null ? 'text-muted-foreground' : 'text-emerald-300',
                        )}
                      >
                        {free == null ? '—' : formatCurrency(free)}
                      </p>
                    </>
                  );

                  const identity = (
                    <div className="flex min-w-0 items-center gap-3">
                      <AccountIcon view={view} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium">{view.name}</p>
                          {badge ? (
                            <span className={badgeToneClass(badge.tone)}>{badge.label}</span>
                          ) : null}
                        </div>
                        <p className="text-[10px] text-muted-foreground">{view.typeLabel}</p>
                        {account?.preview ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {account.preview}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );

                  const rowActions = (
                    <div className="flex w-16 shrink-0 items-center justify-end gap-0.5 pr-5">
                      <IconTipButton
                        label={view.kind === 'loan' ? 'Abrir préstamo' : 'Corregir saldo'}
                        onClick={() => handleEditOrOpen(row)}
                      >
                        {view.kind === 'loan' ? (
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </IconTipButton>
                    </div>
                  );

                  const rowGridClass =
                    'grid min-w-0 flex-1 items-center gap-3 px-5 py-3 text-left sm:grid-cols-[minmax(0,1.4fr)_minmax(7rem,1fr)_minmax(7rem,1fr)]';

                  return (
                    <li key={view.key}>
                      {showLoanHeading ? (
                        <p className="px-5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Préstamos
                        </p>
                      ) : null}
                      {hasWhy && account ? (
                        <Collapsible
                          open={isOpen}
                          onOpenChange={(open) => handleWhyOpenChange(whyId, open)}
                        >
                          <div className="flex items-stretch hover:bg-muted/30">
                            <CollapsibleTrigger asChild>
                              <button
                                type="button"
                                className="flex min-w-0 flex-1 items-center text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                aria-label={`Ver por qué debes en ${view.name}`}
                              >
                                <span className={rowGridClass}>
                                  {identity}
                                  {figuresRow}
                                  {utilizationPct != null ? (
                                    <span className="col-span-full pl-[3.25rem]">
                                      <UtilizationBar utilizationPct={utilizationPct} />
                                    </span>
                                  ) : null}
                                </span>
                                <ChevronDown
                                  className={cn(
                                    'mr-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                    isOpen && 'rotate-180',
                                  )}
                                  aria-hidden
                                />
                              </button>
                            </CollapsibleTrigger>
                            {rowActions}
                          </div>
                          <CollapsibleContent>
                            <div className="px-5 pb-4 pl-[3.25rem]">
                              <LiquidityAccountDebtWhy
                                account={account}
                                onMore={() => handleWhyMore(account)}
                              />
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      ) : (
                        <div className="flex items-stretch hover:bg-muted/30">
                          <button
                            type="button"
                            onClick={() => handleEditOrOpen(row)}
                            className={cn(
                              rowGridClass,
                              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            )}
                            aria-label={
                              view.kind === 'loan'
                                ? `Ver ${view.name} en préstamos`
                                : `Ver o editar ${view.name}`
                            }
                          >
                            {identity}
                            {figuresRow}
                            {utilizationPct != null ? (
                              <div className="col-span-full pl-[3.25rem]">
                                <UtilizationBar utilizationPct={utilizationPct} />
                              </div>
                            ) : null}
                          </button>
                          {rowActions}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </section>

      <Sheet
        open={mobileWhyAccount != null}
        onOpenChange={(open) => {
          if (!open) setMobileWhyId(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[85vh] gap-0 overflow-y-auto rounded-t-2xl px-4 pb-6"
        >
          {mobileWhyAccount ? (
            <>
              <SheetHeader className="px-0 pb-3">
                <SheetTitle>{mobileWhyAccount.name}</SheetTitle>
                <SheetDescription>
                  {mobileWhyAccount.preview || 'De qué está hecha esta deuda'}
                </SheetDescription>
              </SheetHeader>
              <LiquidityAccountDebtWhy
                account={mobileWhyAccount}
                onMore={() => handleWhyMore(mobileWhyAccount)}
              />
              <SheetFooter className="px-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={() => {
                    if (mobileWhyRow) handleEditOrOpen(mobileWhyRow);
                    setMobileWhyId(null);
                  }}
                >
                  {mobileWhyAccount.kind === 'loan' ? 'Abrir préstamo' : 'Corregir saldo'}
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {selectedCard ? (
        <WalletBalanceDialog
          open
          onOpenChange={(open) => {
            if (!open) setSelectedCard(null);
          }}
          walletId={selectedCard.id}
          walletName={selectedCard.name}
          currentAmount={Number(selectedCard.amount) || 0}
          context={context}
          variant={
            isCreditOrStoreCardWalletType(selectedCard.type) ? 'credit' : 'funding'
          }
          creditLimit={selectedCard.credit_limit}
          onSuccess={() => {
            void load();
            onChanged?.();
          }}
        />
      ) : null}
    </>
  );
};
