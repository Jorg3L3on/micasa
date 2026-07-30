'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  getProviderBrandColor,
  getProviderCardStyle,
  getWalletBrandCssVars,
} from '@/lib/provider-card-style';
import {
  buildWalletAttentionCards,
  type WalletAttentionCard,
} from '@/lib/finance/wallet-attention';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { DuePaymentItem, WalletListItem } from '@/types/catalog';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';

type PlannerMonthDuePayments = {
  first: DuePaymentItem[];
  second: DuePaymentItem[];
};

const roleLabel = (roles: WalletAttentionCard['roles']): string => {
  const hasUsage = roles.includes('usage');
  const hasPayment = roles.includes('payment');
  if (hasUsage && hasPayment) return 'Mayor uso · Próximo pago';
  if (hasUsage) return 'Mayor uso';
  return 'Próximo pago';
};

function AttentionCard({
  card,
  ownerQueryString,
}: {
  card: WalletAttentionCard;
  ownerQueryString: string;
}) {
  const providerCardStyle = getProviderCardStyle(
    card.providerIconKey,
    card.type,
    'list',
  );
  const brandColor =
    getProviderBrandColor(card.providerIconKey, card.type) ?? '#6366f1';
  const brandCssVars = getWalletBrandCssVars(brandColor);
  const style = { ...providerCardStyle, ...brandCssVars };
  const href = `/credit-cards/${card.walletId}${ownerQueryString}`;
  const hasUsage = card.roles.includes('usage');
  const hasPayment = card.roles.includes('payment');
  const usagePercent = card.usagePercent ?? 0;

  return (
    <Link
      href={href}
      aria-label={`${card.name}, ${roleLabel(card.roles)}`}
      className={cn(
        'group flex min-h-[140px] flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm',
        'transition-shadow duration-200 hover:shadow-md motion-reduce:transition-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        !providerCardStyle && 'border-border/60',
      )}
      style={style}
    >
      <div className="flex items-start gap-2.5">
        <WalletProviderIcon
          providerIconKey={card.providerIconKey}
          className="h-8 w-8 shrink-0 rounded-lg border border-border/60 bg-card shadow-sm ring-1 ring-border/60"
          iconClassName="h-4 w-4"
          showTooltipLabel={false}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {card.name}
          </p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {roleLabel(card.roles)}
          </p>
        </div>
      </div>

      {hasUsage && hasPayment ? (
        <div className="mt-auto grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Uso
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-foreground">
              {usagePercent.toFixed(0)}%
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {formatCurrency(card.debtAmount ?? 0)}
              {card.creditLimit != null && card.creditLimit > 0
                ? ` de ${formatCurrency(card.creditLimit)}`
                : ''}
            </p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Por pagar
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-foreground">
              {formatCurrency(card.nextDuePayment ?? 0)}
            </p>
            {card.statementDueDate ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(card.statementDueDate)}
              </p>
            ) : null}
          </div>
        </div>
      ) : hasUsage ? (
        <div className="mt-auto space-y-2">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Deuda
              </p>
              <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {formatCurrency(card.debtAmount ?? 0)}
              </p>
            </div>
            <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-muted-foreground">
              {usagePercent.toFixed(0)}% usado
            </p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
            <div
              className="h-full rounded-full bg-[var(--wallet-brand)] transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mt-auto">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Por pagar
          </p>
          <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatCurrency(card.nextDuePayment ?? 0)}
          </p>
          {card.statementDueDate ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Vence {formatDate(card.statementDueDate)}
            </p>
          ) : null}
        </div>
      )}
    </Link>
  );
}

export default function MyCardsPanel() {
  const { context } = useFinanceContext();
  const [wallets, setWallets] = useState<WalletListItem[]>([]);
  const [duePayments, setDuePayments] = useState<DuePaymentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }

    const today = todayCalendarDate();
    const year = Number(today.slice(0, 4));
    const month = Number(today.slice(5, 7));

    try {
      setLoading(true);
      const [walletList, partitioned] = await Promise.all([
        clientFetchFromApi<WalletListItem[]>('/api/wallets', undefined, context),
        clientFetchFromApi<PlannerMonthDuePayments>(
          `/api/wallets/due-payments?year=${year}&month=${month}`,
          undefined,
          context,
        ),
      ]);
      setWallets(walletList.filter((w) => w.active));
      setDuePayments([...(partitioned.first ?? []), ...(partitioned.second ?? [])]);
    } catch {
      setWallets([]);
      setDuePayments([]);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = useMemo(
    () =>
      buildWalletAttentionCards({
        wallets,
        duePayments,
      }),
    [wallets, duePayments],
  );

  if (loading) {
    return (
      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        aria-busy="true"
        aria-label="Cargando tarjetas a vigilar"
      >
        <div className="h-[140px] animate-pulse rounded-xl border border-border/60 bg-muted/30" />
        <div className="hidden h-[140px] animate-pulse rounded-xl border border-border/60 bg-muted/20 sm:block" />
      </div>
    );
  }

  if (cards.length === 0) return null;

  return (
    <section
      className={cn(
        'grid gap-4',
        cards.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2',
      )}
      aria-label="Tarjetas a vigilar"
    >
      {cards.map((card) => (
        <AttentionCard
          key={`${card.walletId}-${card.roles.join('-')}`}
          card={card}
          ownerQueryString={ownerQueryString}
        />
      ))}
    </section>
  );
}
