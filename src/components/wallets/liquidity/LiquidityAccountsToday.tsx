'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  isCreditOrStoreCardWalletType,
  PAYMENT_METHOD_LABELS,
} from '@/domain/payment-method';
import { cn, formatCurrency } from '@/lib/utils';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { LiquiditySectionHeader } from '@/components/wallets/liquidity/liquidity-section';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { getCardRiskLabel } from '@/components/wallets/liquidity/liquidity-personalization';
import {
  getAccountLiveFigures,
  sortAccountsToday,
} from '@/components/wallets/liquidity/liquidity-accounts-today';
import type { WalletListItem } from '@/types/catalog';

type LiquidityAccountsTodayProps = {
  onChanged?: () => void;
  actions?: ReactNode;
  fundingTotal?: number;
  sectionIcon?: LucideIcon;
};

const AccountCard = ({
  account,
  onSelect,
}: {
  account: WalletListItem;
  onSelect: (account: WalletListItem) => void;
}) => {
  const { isCredit, debt, free, utilizationPct, isUnrated } = getAccountLiveFigures(account);
  const risk = getCardRiskLabel(utilizationPct, isUnrated);
  const typeLabel =
    PAYMENT_METHOD_LABELS[account.type as keyof typeof PAYMENT_METHOD_LABELS] ??
    account.type;

  return (
    <button
      type="button"
      onClick={() => onSelect(account)}
      className={cn(
        'flex w-[min(100%,17.5rem)] shrink-0 snap-start flex-col gap-3 rounded-xl border border-border/60 bg-card/80 p-3 text-left',
        'transition-colors hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'dark:border-white/[0.08] dark:bg-[#0a1020]/80',
      )}
      aria-label={`Ver o editar ${account.name}`}
    >
      <div className="flex items-start gap-2.5">
        <WalletProviderIcon
          providerIconKey={account.provider_icon_key}
          className="h-9 w-9 shrink-0 rounded-lg border border-border/60 bg-card"
          iconClassName="h-5 w-5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium">{account.name}</p>
            {isCredit ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                  risk.tone === 'destructive' &&
                    'bg-destructive/10 text-destructive ring-destructive/20',
                  risk.tone === 'amber' &&
                    'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-300',
                  risk.tone === 'emerald' &&
                    'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
                  risk.tone === 'muted' &&
                    'bg-muted text-muted-foreground ring-border/40',
                )}
              >
                {risk.label}
              </span>
            ) : null}
          </div>
          <p className="text-[10px] text-muted-foreground">{typeLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Deuda
          </p>
          <p
            className={cn(
              'font-mono text-sm font-bold tabular-nums',
              isCredit ? 'text-violet-300' : 'text-muted-foreground',
            )}
          >
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

      {utilizationPct != null ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              utilizationPct > 80
                ? 'bg-destructive/80'
                : utilizationPct > 50
                  ? 'bg-amber-500/80'
                  : 'bg-emerald-500/80',
            )}
            style={{ width: `${utilizationPct}%` }}
          />
        </div>
      ) : null}
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
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState<WalletListItem | null>(null);

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      const walletList = await clientFetchFromApi<WalletListItem[]>(
        '/api/wallets',
        undefined,
        context,
      );
      setWallets(Array.isArray(walletList) ? walletList : []);
    } catch {
      setWallets([]);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  const accounts = useMemo(() => sortAccountsToday(wallets), [wallets]);

  const description =
    fundingTotal != null ? (
      <>
        Hoy tienes{' '}
        <span className="font-mono font-semibold tabular-nums text-emerald-300">
          {formatCurrency(fundingTotal)}
        </span>{' '}
        en efectivo y débito. Toca una cuenta para corregir el saldo.
      </>
    ) : (
      'Deuda y lo que te queda libre ahora. Toca una cuenta para corregir el saldo.'
    );

  return (
    <>
      {SectionIcon ? (
        <LiquiditySectionHeader
          id="liquidity-cards-today-heading"
          title="Tus tarjetas hoy"
          description={description}
          icon={SectionIcon}
          accent="emerald"
          actions={
            <>
              {actions}
              <span className="text-xs tabular-nums text-muted-foreground">
                {accounts.length} cuenta{accounts.length === 1 ? '' : 's'}
              </span>
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
                Tus tarjetas hoy
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {actions}
              <span className="text-xs tabular-nums text-muted-foreground">
                {accounts.length} cuenta{accounts.length === 1 ? '' : 's'}
              </span>
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
        ) : accounts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
            No hay cuentas activas de efectivo o tarjeta.
          </p>
        ) : (
          <>
            <div className="relative sm:hidden">
              <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide snap-x snap-mandatory">
                {accounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onSelect={setSelectedCard}
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
                {accounts.map((account) => {
                  const { isCredit, debt, free, utilizationPct, isUnrated } =
                    getAccountLiveFigures(account);
                  const risk = getCardRiskLabel(utilizationPct, isUnrated);
                  const typeLabel =
                    PAYMENT_METHOD_LABELS[account.type as keyof typeof PAYMENT_METHOD_LABELS] ??
                    account.type;

                  return (
                    <li key={account.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCard(account)}
                        className="grid w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1.4fr)_minmax(7rem,1fr)_minmax(7rem,1fr)]"
                        aria-label={`Ver o editar ${account.name}`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <WalletProviderIcon
                            providerIconKey={account.provider_icon_key}
                            className="h-9 w-9 shrink-0 rounded-lg border border-border/60 bg-card"
                            iconClassName="h-5 w-5"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-medium">{account.name}</p>
                              {isCredit ? (
                                <span
                                  className={cn(
                                    'rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1',
                                    risk.tone === 'destructive' &&
                                      'bg-destructive/10 text-destructive ring-destructive/20',
                                    risk.tone === 'amber' &&
                                      'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-300',
                                    risk.tone === 'emerald' &&
                                      'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
                                    risk.tone === 'muted' &&
                                      'bg-muted text-muted-foreground ring-border/40',
                                  )}
                                >
                                  {risk.label}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[10px] text-muted-foreground">{typeLabel}</p>
                          </div>
                        </div>

                        <p
                          className={cn(
                            'font-mono text-sm font-bold tabular-nums sm:text-right',
                            isCredit ? 'text-violet-300' : 'text-muted-foreground',
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
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  utilizationPct > 80
                                    ? 'bg-destructive/80'
                                    : utilizationPct > 50
                                      ? 'bg-amber-500/80'
                                      : 'bg-emerald-500/80',
                                )}
                                style={{ width: `${utilizationPct}%` }}
                              />
                            </div>
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
            isCreditOrStoreCardWalletType(selectedCard.type)
              ? 'credit'
              : 'funding'
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
