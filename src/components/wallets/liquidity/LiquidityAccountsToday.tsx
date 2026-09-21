'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import { listLoans } from '@/lib/api/loans';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import { cn, formatCurrency } from '@/lib/utils';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { LiquiditySectionHeader } from '@/components/wallets/liquidity/liquidity-section';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import {
  buildAccountsToday,
  toAccountTodayView,
  type AccountTodayBadge,
  type AccountTodayRow,
  type AccountTodayView,
} from '@/components/wallets/liquidity/liquidity-accounts-today';
import type { WalletListItem } from '@/types/catalog';
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

const AccountCard = ({
  view,
  onSelect,
}: {
  view: AccountTodayView;
  onSelect: () => void;
}) => {
  const { figures, badge } = view;
  const { debt, free, utilizationPct } = figures;
  const debtTone =
    view.kind === 'loan'
      ? 'text-amber-300'
      : figures.isCredit
        ? 'text-violet-300'
        : 'text-muted-foreground';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-[min(100%,17.5rem)] shrink-0 snap-start flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-3 text-left',
        'transition-colors hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'dark:border-white/[0.08] dark:bg-[#0a1020]/80',
      )}
      aria-label={
        view.kind === 'loan'
          ? `Ver ${view.name} en préstamos`
          : `Ver o editar ${view.name}`
      }
    >
      <div className="flex items-start gap-2.5">
        <AccountIcon view={view} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium">{view.name}</p>
            {badge ? <span className={badgeToneClass(badge.tone)}>{badge.label}</span> : null}
          </div>
          <p className="text-[10px] text-muted-foreground">{view.typeLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Deuda
          </p>
          <p className={cn('font-mono text-sm font-bold tabular-nums', debtTone)}>
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
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<WalletListItem | null>(null);

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      const [walletList, loanList] = await Promise.all([
        clientFetchFromApi<WalletListItem[]>('/api/wallets', undefined, context),
        listLoans(context),
      ]);
      setWallets(Array.isArray(walletList) ? walletList : []);
      setLoans(Array.isArray(loanList) ? loanList : []);
    } catch {
      setWallets([]);
      setLoans([]);
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

  const handleSelect = (row: AccountTodayRow) => {
    if (row.kind === 'wallet') {
      setSelectedCard(row.wallet);
      return;
    }
    const params = buildOwnerQuery(context);
    params.set('loanId', String(row.loan.id));
    router.push(`/loans?${params.toString()}`);
  };

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
        en efectivo y débito. Toca una cuenta para corregir el saldo o un préstamo para ver el
        detalle.
      </>
    ) : (
      'Deuda y lo que te queda libre ahora. Toca una cuenta para corregir el saldo o un préstamo para ver el detalle.'
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
            <div className="relative sm:hidden">
              <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide snap-x snap-mandatory">
                {views.map((view, index) => (
                  <AccountCard
                    key={view.key}
                    view={view}
                    onSelect={() => handleSelect(rows[index]!)}
                  />
                ))}
              </div>
              <div
                className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent dark:from-[#0d1327]"
                aria-hidden
              />
            </div>

            <div className="hidden sm:block">
              <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(7rem,1fr)_minmax(7rem,1fr)] gap-3 border-t border-border/40 px-5 py-2">
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
                  const { figures, badge } = view;
                  const { debt, free, utilizationPct } = figures;
                  const debtTone =
                    view.kind === 'loan'
                      ? 'text-amber-300'
                      : figures.isCredit
                        ? 'text-violet-300'
                        : 'text-muted-foreground';
                  const showLoanHeading =
                    view.kind === 'loan' && (index === 0 || views[index - 1]?.kind !== 'loan');

                  return (
                    <li key={view.key}>
                      {showLoanHeading ? (
                        <p className="px-5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Préstamos
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleSelect(rows[index]!)}
                        className="grid w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1.4fr)_minmax(7rem,1fr)_minmax(7rem,1fr)]"
                        aria-label={
                          view.kind === 'loan'
                            ? `Ver ${view.name} en préstamos`
                            : `Ver o editar ${view.name}`
                        }
                      >
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
                          </div>
                        </div>

                        <p
                          className={cn(
                            'font-mono text-sm font-bold tabular-nums sm:text-right',
                            debtTone,
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

                        {utilizationPct != null ? (
                          <div className="col-span-full pl-[3.25rem]">
                            <UtilizationBar utilizationPct={utilizationPct} />
                          </div>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </section>

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
