'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  isCreditOrStoreCardWalletType,
  PAYMENT_METHOD_LABELS,
} from '@/domain/payment-method';
import { cn, formatCurrency } from '@/lib/utils';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
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
};

export const LiquidityAccountsToday = ({
  onChanged,
  actions,
  fundingTotal,
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

  return (
    <>
      <section
        className={cn(MONTHLY_PANEL_SHELL_CLASS, 'overflow-hidden')}
        aria-labelledby="liquidity-cards-today-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <h2
              id="liquidity-cards-today-heading"
              className="text-base font-semibold leading-tight"
            >
              Tus tarjetas hoy
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {fundingTotal != null ? (
                <>
                  Hoy tienes{' '}
                  <span className="font-mono font-semibold tabular-nums text-emerald-300">
                    {formatCurrency(fundingTotal)}
                  </span>{' '}
                  en efectivo y débito. Toca una cuenta para corregir el saldo.
                </>
              ) : (
                'Deuda y lo que te queda libre ahora. Toca una cuenta para corregir el saldo.'
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <span className="text-xs text-muted-foreground tabular-nums">
              {accounts.length} cuenta{accounts.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {!loading && accounts.length > 0 ? (
        <div className="hidden border-t border-border/40 sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(7rem,1fr)_minmax(7rem,1fr)] sm:gap-3 sm:px-5 sm:py-2">
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
        ) : null}

        {loading ? (
          <div className="space-y-3 border-t border-border/40 px-4 py-4 sm:px-5" aria-hidden>
            <div className="h-12 animate-pulse rounded-xl bg-muted/40" />
            <div className="h-12 animate-pulse rounded-xl bg-muted/40" />
          </div>
        ) : accounts.length === 0 ? (
          <p className="border-t border-border/40 px-4 py-8 text-center text-sm text-muted-foreground">
            No hay cuentas activas de efectivo o tarjeta.
          </p>
        ) : (
        <ul className="divide-y divide-border/40 border-t border-border/40 sm:border-t-0">
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
                  className="grid w-full items-start gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1.4fr)_minmax(7rem,1fr)_minmax(7rem,1fr)] sm:items-center sm:gap-3 sm:px-5"
                  aria-label={`Ver o editar ${account.name}`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <WalletProviderIcon
                      providerIconKey={account.provider_icon_key}
                      className="mt-0.5 h-9 w-9 shrink-0 rounded-lg border border-border/60 bg-card"
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

                  <div className="flex items-baseline justify-between gap-3 pl-12 sm:block sm:pl-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:hidden">
                      Deuda
                    </p>
                    <p
                      className={cn(
                        'font-mono text-sm font-bold tabular-nums sm:text-right',
                        isCredit ? 'text-violet-300' : 'text-muted-foreground',
                      )}
                    >
                      {debt == null ? '—' : formatCurrency(debt)}
                    </p>
                  </div>

                  <div className="flex items-baseline justify-between gap-3 pl-12 sm:block sm:pl-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:hidden">
                      Libre
                    </p>
                    <p
                      className={cn(
                        'font-mono text-sm font-bold tabular-nums sm:text-right',
                        free == null ? 'text-muted-foreground' : 'text-emerald-300',
                      )}
                    >
                      {free == null ? '—' : formatCurrency(free)}
                    </p>
                  </div>

                  {utilizationPct != null ? (
                    <div className="col-span-full pl-12 sm:col-span-3 sm:pl-[3.25rem]">
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
