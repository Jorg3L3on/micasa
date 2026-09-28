'use client';

import EmptyState from '@/components/EmptyState';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, CreditCard, ExternalLink, Pencil } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  emptyLiquidityDebtBreakdown,
  fetchLiquidityDebtBreakdown,
} from '@/lib/api/liquidity';
import { listLoans } from '@/lib/api/loans';
import { accountHasDebtWhy } from '@/lib/finance/liquidity-debt-breakdown';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import { AURA_TONE_HEX, getAuraWalletColor } from '@/lib/ui/aura-palette';
import { cn, formatCurrency } from '@/lib/utils';
import { AuraRowBloom } from '@/components/aura/aura-surface';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { LiquidityAccountDebtWhy } from '@/components/wallets/liquidity/LiquidityAccountDebtWhy';
import { MoneyInText } from '@/components/wallets/liquidity/money-in-text';
import { LiquidityDebtSummaryStrip } from '@/components/wallets/liquidity/LiquidityDebtSummaryStrip';
import {
  LIQUIDITY_PANEL_CLASS,
  LiquidityPanelHeader,
} from '@/components/wallets/liquidity/liquidity-section';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
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
  /** Bumped by the workspace pull-to-refresh to reload this section. */
  refreshToken?: number;
};

const ACCOUNTS_PREVIEW_COUNT = 6;

const badgeToneClass = (tone: AccountTodayBadge['tone']): string =>
  cn(
    'rounded-full px-2 py-0.5 text-caption font-semibold ring-1',
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
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/15 text-caption font-bold tracking-wide text-teal-800 ring-1 ring-teal-500/30 dark:text-teal-200"
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
    ? 'text-amber-700 dark:text-amber-300'
    : view.figures.isCredit
      ? 'text-violet-700 dark:text-violet-300'
      : 'text-muted-foreground';

const breakdownKeyForRow = (row: AccountTodayRow): string =>
  row.kind === 'wallet' ? `wallet-${row.wallet.id}` : `loan-${row.loan.id}`;

const accountAuraColor = (view: AccountTodayView): string =>
  view.kind === 'loan'
    ? AURA_TONE_HEX.amber
    : getAuraWalletColor(
        view.providerIconKey,
        undefined,
        view.figures.isCredit ? 'violet' : 'emerald',
      );

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
        MONTHLY_PANEL_SHELL_CLASS,
        'isolate flex w-full flex-col gap-3 overflow-hidden rounded-xl p-3 text-left',
      )}
    >
      <AuraRowBloom color={accountAuraColor(view)} />
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
              <p className="truncate text-sm font-semibold">{view.name}</p>
              {badge ? <span className={badgeToneClass(badge.tone)}>{badge.label}</span> : null}
            </div>
            <p className="text-caption text-muted-foreground">{view.typeLabel}</p>
            {preview ? (
              <p className="mt-1 text-caption leading-snug text-muted-foreground">
                <MoneyInText text={preview} />
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="overline text-muted-foreground">
              Deuda
            </p>
            <p className={cn('font-sans text-sm font-bold tabular-nums', debtToneClass(view))}>
              {debt == null ? '—' : formatCurrency(debt)}
            </p>
          </div>
          <div className="text-right">
            <p className="overline text-muted-foreground">
              Libre
            </p>
            <p
              className={cn(
                'font-sans text-sm font-bold tabular-nums',
                free == null ? 'text-muted-foreground' : 'text-emerald-700 dark:text-emerald-300',
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
  refreshToken = 0,
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
  const [whyDetailId, setWhyDetailId] = useState<string | null>(null);

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
  }, [load, refreshToken]);

  const rows = useMemo(() => buildAccountsToday(wallets, loans), [loans, wallets]);
  const views = useMemo(() => rows.map(toAccountTodayView), [rows]);
  const debtFirstIndexes = useMemo(
    () =>
      views
        .map((view, index) => ({ index, debt: view.figures.debt ?? 0 }))
        .sort((a, b) => b.debt - a.debt)
        .map((entry) => entry.index),
    [views],
  );
  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const visibleIndexes = showAllAccounts
    ? debtFirstIndexes
    : debtFirstIndexes.slice(0, ACCOUNTS_PREVIEW_COUNT);
  const hiddenAccountCount = views.length - ACCOUNTS_PREVIEW_COUNT;

  const handleToggleShowAll = () => {
    setShowAllAccounts((current) => !current);
  };
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

  const handleSelect = (row: AccountTodayRow) => {
    const account = getBreakdown(row);
    if (accountHasDebtWhy(account)) {
      setWhyDetailId(account!.id);
      return;
    }
    handleEditOrOpen(row);
  };

  const whyDetailAccount = whyDetailId
    ? breakdownById.get(whyDetailId) ?? null
    : null;
  const whyDetailRow = whyDetailAccount
    ? rows.find((row) => breakdownKeyForRow(row) === whyDetailAccount.id) ?? null
    : null;

  const handleWhyDetailOpenChange = (open: boolean) => {
    if (!open) setWhyDetailId(null);
  };

  const handleWhyDetailAction = () => {
    if (whyDetailRow) handleEditOrOpen(whyDetailRow);
    setWhyDetailId(null);
  };

  const countLabel =
    loanCount > 0
      ? `${walletCount} cuenta${walletCount === 1 ? '' : 's'} · ${loanCount} préstamo${loanCount === 1 ? '' : 's'}`
      : `${walletCount} cuenta${walletCount === 1 ? '' : 's'}`;

  const subtitle =
    fundingTotal != null ? (
      <>
        <span className="font-sans font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
          {formatCurrency(fundingTotal)}
        </span>{' '}
        en efectivo y débito · {countLabel}
      </>
    ) : (
      `Deuda y lo que te queda libre ahora · ${countLabel}`
    );

  return (
    <>
      <section
        className={cn(LIQUIDITY_PANEL_CLASS, 'space-y-3')}
        aria-labelledby="liquidity-cards-today-heading"
      >
        <LiquidityPanelHeader
          id="liquidity-cards-today-heading"
          title="Tus tarjetas y préstamos hoy"
          subtitle={subtitle}
          icon={CreditCard}
          actions={actions}
        />

        {loading ? (
          <div className="space-y-2" aria-hidden>
            <Skeleton className="h-20 w-full rounded-lg border border-border/60" />
            <Skeleton className="h-28 w-full rounded-xl border border-border/60" />
            <Skeleton className="h-28 w-full rounded-xl border border-border/60" />
          </div>
        ) : views.length === 0 ? (
          <EmptyState
            message="No hay cuentas activas de efectivo, tarjeta o préstamo."
            className="py-8"
          />
        ) : (
          <>
            <LiquidityDebtSummaryStrip
              breakdown={breakdown}
              error={breakdownError}
              onRetry={() => {
                void load();
              }}
            />
            <p className="px-1 text-caption text-muted-foreground">
              Toca una deuda para ver de qué está hecha.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1" role="list">
              {visibleIndexes.map((index) => {
                const view = views[index]!;
                const row = rows[index]!;
                const account = getBreakdown(row);
                return (
                  <li key={view.key} className="min-w-0">
                    <AccountCard
                      view={view}
                      preview={account?.preview ?? ''}
                      hasWhy={accountHasDebtWhy(account)}
                      onSelect={() => handleSelect(row)}
                      onEdit={() => handleEditOrOpen(row)}
                    />
                  </li>
                );
              })}
            </ul>
            {hiddenAccountCount > 0 ? (
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                aria-expanded={showAllAccounts}
                onClick={handleToggleShowAll}
              >
                {showAllAccounts ? (
                  <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {showAllAccounts ? 'Ver menos' : `Ver las ${views.length} cuentas`}
              </Button>
            ) : null}
          </>
        )}
      </section>

      <ResponsiveOverlay
        open={whyDetailAccount != null}
        onOpenChange={handleWhyDetailOpenChange}
        title={whyDetailAccount?.name ?? ''}
        description={whyDetailAccount?.preview || 'De qué está hecha esta deuda'}
        dismissLabel="Cerrar"
      >
        {whyDetailAccount ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {whyDetailAccount.preview ? (
                <MoneyInText text={whyDetailAccount.preview} size="row" />
              ) : (
                'De qué está hecha esta deuda'
              )}
            </p>
            <LiquidityAccountDebtWhy
              account={whyDetailAccount}
              onMore={() => handleWhyMore(whyDetailAccount)}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl"
              onClick={handleWhyDetailAction}
            >
              {whyDetailAccount.kind === 'loan' ? 'Abrir préstamo' : 'Corregir saldo'}
            </Button>
          </div>
        ) : null}
      </ResponsiveOverlay>

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
