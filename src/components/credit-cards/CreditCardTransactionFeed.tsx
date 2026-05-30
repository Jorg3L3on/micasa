'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
  creditCardSegmentedFilterButtonClass,
  creditCardSegmentedTabChromeClass,
} from '@/components/credit-cards/credit-card-segmented-tabs';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import type {
  CreditCardPaymentListItem,
  CreditCardStatementPurchaseItem,
} from '@/types/catalog';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const getDateGroupLabel = (dateStr: string): string => {
  const day = dateStr.slice(0, 10);
  const today = getTodayDateString();
  if (day === today) return 'Hoy';

  const yesterday = new Date(today + 'T12:00:00Z');
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  if (day === yesterdayStr) return 'Ayer';

  return formatDate(day);
};

const groupByDate = <T extends { dateKey: string }>(items: T[]) => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.dateKey.slice(0, 10);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
};

const getFortnightHref = (
  purchase: CreditCardStatementPurchaseItem,
  ownerQueryString: string,
) =>
  `/fortnight/${purchase.fortnight_year}/${String(purchase.fortnight_month).padStart(2, '0')}/${purchase.fortnight_period}${ownerQueryString}`;

type FeedEmptyProps = {
  message: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

export const CreditCardFeedEmpty = ({
  message,
  description,
  action,
}: FeedEmptyProps) => (
  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/60 bg-muted/15 px-4 py-8 text-center">
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
      <Inbox className="h-4 w-4 text-muted-foreground" aria-hidden />
    </span>
    <p className="text-sm font-medium text-foreground">{message}</p>
    {description ? (
      <p className="max-w-xs text-xs text-muted-foreground">{description}</p>
    ) : null}
    {action ? (
      <Button type="button" size="sm" variant="outline" className="mt-1 h-8 rounded-lg" onClick={action.onClick}>
        {action.label}
      </Button>
    ) : null}
  </div>
);

type MovementFilter = 'all' | 'purchases' | 'payments';

type UnifiedMovement =
  | {
      kind: 'purchase';
      id: number;
      dateKey: string;
      sortKey: string;
      purchase: CreditCardStatementPurchaseItem;
    }
  | {
      kind: 'payment';
      id: number;
      dateKey: string;
      sortKey: string;
      payment: CreditCardPaymentListItem;
    };

type RecentMovementsProps = {
  purchases: CreditCardStatementPurchaseItem[];
  payments: CreditCardPaymentListItem[];
  ownerQueryString: string;
  onRegisterPurchase?: () => void;
  onRegisterPayment?: () => void;
};

export const CreditCardRecentMovements = ({
  purchases,
  payments,
  ownerQueryString,
  onRegisterPurchase,
  onRegisterPayment,
}: RecentMovementsProps) => {
  const [filter, setFilter] = useState<MovementFilter>('all');
  const [query, setQuery] = useState('');

  const movements = useMemo(() => {
    const rows: UnifiedMovement[] = [
      ...purchases.map((purchase) => ({
        kind: 'purchase' as const,
        id: purchase.id,
        dateKey: purchase.payment_date,
        sortKey: purchase.payment_date,
        purchase,
      })),
      ...payments.map((payment) => ({
        kind: 'payment' as const,
        id: payment.id,
        dateKey: payment.paid_at,
        sortKey: payment.paid_at,
        payment,
      })),
    ];
    return rows.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [purchases, payments]);

  const filtered = useMemo(() => {
    let rows = movements;
    if (filter === 'purchases') {
      rows = rows.filter((row) => row.kind === 'purchase');
    } else if (filter === 'payments') {
      rows = rows.filter((row) => row.kind === 'payment');
    }

    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      if (row.kind === 'purchase') {
        return (
          row.purchase.description.toLowerCase().includes(q) ||
          row.purchase.category.toLowerCase().includes(q)
        );
      }
      return (
        row.payment.source_wallet_name.toLowerCase().includes(q) ||
        (row.payment.note?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [filter, movements, query]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const filterOptions: { value: MovementFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'purchases', label: 'Compras' },
    { value: 'payments', label: 'Pagos' },
  ];

  const isEmpty = purchases.length === 0 && payments.length === 0;

  return (
    <div role="region" aria-label="Movimientos recientes" className="space-y-4">
      <div className="space-y-3">
        <div className={creditCardSegmentedTabChromeClass}>
          <div
            className="grid w-full grid-cols-3 gap-1"
            role="tablist"
            aria-label="Filtrar movimientos"
          >
            {filterOptions.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={creditCardSegmentedFilterButtonClass(filter === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!isEmpty &&
        !(filter === 'purchases' && purchases.length === 0) &&
        !(filter === 'payments' && payments.length === 0) ? (
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar movimientos…"
            className="h-9 w-full border-border/50 bg-muted/20 text-sm"
            aria-label="Buscar movimientos"
          />
        ) : null}
      </div>

      {isEmpty ? (
        <CreditCardFeedEmpty
          message="Sin movimientos en este ciclo"
          description="Registra una compra o un pago para verlos aquí."
          action={
            onRegisterPurchase
              ? { label: 'Registrar compra', onClick: onRegisterPurchase }
              : undefined
          }
        />
      ) : filter === 'purchases' && purchases.length === 0 ? (
        <CreditCardFeedEmpty
          message="Sin compras en este ciclo"
          description="Registra un gasto con esta tarjeta."
          action={
            onRegisterPurchase
              ? { label: 'Registrar compra', onClick: onRegisterPurchase }
              : undefined
          }
        />
      ) : filter === 'payments' && payments.length === 0 ? (
        <CreditCardFeedEmpty
          message="Sin pagos registrados"
          description="Registra un abono para verlo en la lista."
          action={
            onRegisterPayment
              ? { label: 'Registrar pago', onClick: onRegisterPayment }
              : undefined
          }
        />
      ) : grouped.length === 0 ? (
        <CreditCardFeedEmpty
          message="Sin resultados"
          description="Prueba otro filtro o término de búsqueda."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([dateKey, dayItems]) => (
            <section key={dateKey} aria-label={getDateGroupLabel(dateKey)}>
              <h4 className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {getDateGroupLabel(dateKey)}
              </h4>
              <ul className="divide-y divide-border/40 rounded-2xl border border-border/50 bg-muted/10 dark:bg-muted/5">
                {dayItems.map((row) =>
                  row.kind === 'purchase' ? (
                    <li key={`p-${row.id}`}>
                      <div className="flex items-center gap-3 px-3 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10 ring-1 ring-violet-500/20">
                          <ArrowUpRight className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-tight">
                            {row.purchase.description}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[10px] text-muted-foreground">
                            <CategoryLabel
                              name={row.purchase.category}
                              icon={row.purchase.categoryIcon}
                            />
                            {row.purchase.credit_installment_current != null &&
                            row.purchase.credit_installment_total != null ? (
                              <>
                                <span className="text-muted-foreground/30">·</span>
                                <span>
                                  Cuota {row.purchase.credit_installment_current}/
                                  {row.purchase.credit_installment_total}
                                </span>
                              </>
                            ) : null}
                          </p>
                          <Link
                            href={getFortnightHref(row.purchase, ownerQueryString)}
                            className="mt-0.5 inline-block text-[10px] font-medium text-primary underline-offset-2 hover:underline"
                          >
                            Ver quincena
                          </Link>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                          {formatCurrency(row.purchase.amount)}
                        </span>
                      </div>
                    </li>
                  ) : (
                    <li key={`pay-${row.id}`}>
                      <div className="flex items-center gap-3 px-3 py-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20">
                          <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <WalletIdentity
                              name={row.payment.source_wallet_name}
                              providerIconKey={row.payment.source_wallet_provider_icon_key}
                              className="truncate text-sm font-semibold"
                              iconClassName="hidden"
                            />
                          </div>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            Pago a tarjeta
                            {row.payment.note ? ` · ${row.payment.note}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(row.payment.amount)}
                        </span>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

type GroupedPurchaseFeedProps = {
  items: CreditCardStatementPurchaseItem[];
  ownerQueryString: string;
  regionLabel: string;
  emptyText: string;
  showSearch?: boolean;
};

export const GroupedPurchaseFeed = ({
  items,
  ownerQueryString,
  regionLabel,
  emptyText,
  showSearch = true,
}: GroupedPurchaseFeedProps) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  }, [items, query]);

  const grouped = useMemo(
    () =>
      groupByDate(
        [...filtered]
          .sort((a, b) => b.payment_date.localeCompare(a.payment_date))
          .map((item) => ({ ...item, dateKey: item.payment_date })),
      ),
    [filtered],
  );

  if (items.length === 0) {
    return <CreditCardFeedEmpty message={emptyText} />;
  }

  return (
    <div role="region" aria-label={regionLabel} className="space-y-4">
      {showSearch ? (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar…"
          className="h-9 border-border/60 bg-muted/20 text-sm"
          aria-label={`Filtrar: ${regionLabel}`}
        />
      ) : null}

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay compras que coincidan con el filtro.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map(([dateKey, dayItems]) => (
            <section key={dateKey} aria-label={getDateGroupLabel(dateKey)}>
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {getDateGroupLabel(dateKey)}
              </h4>
              <ul className="space-y-1">
                {dayItems.map((purchase) => (
                  <li key={purchase.id}>
                    <div className="flex items-center gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-muted/30">
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/60 text-xs font-semibold uppercase text-muted-foreground ring-1 ring-border/40"
                        aria-hidden
                      >
                        {purchase.category.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {purchase.description}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-[10px] text-muted-foreground">
                          <CategoryLabel
                            name={purchase.category}
                            icon={purchase.categoryIcon}
                          />
                          {purchase.credit_installment_current != null &&
                          purchase.credit_installment_total != null ? (
                            <>
                              <span className="text-muted-foreground/30">·</span>
                              <span>
                                Cuota {purchase.credit_installment_current}/
                                {purchase.credit_installment_total}
                              </span>
                            </>
                          ) : null}
                        </p>
                        <Link
                          href={getFortnightHref(purchase, ownerQueryString)}
                          className="mt-0.5 inline-block text-[10px] font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Ver quincena
                        </Link>
                      </div>
                      <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                        {formatCurrency(purchase.amount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

type GroupedPaymentFeedProps = {
  items: CreditCardPaymentListItem[];
  regionLabel: string;
  emptyText?: string;
  showSearch?: boolean;
};

export const GroupedPaymentFeed = ({
  items,
  regionLabel,
  emptyText = 'Todavía no hay pagos registrados.',
  showSearch = true,
}: GroupedPaymentFeedProps) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.source_wallet_name.toLowerCase().includes(q) ||
        (item.note?.toLowerCase().includes(q) ?? false),
    );
  }, [items, query]);

  const grouped = useMemo(
    () =>
      groupByDate(
        [...filtered]
          .sort((a, b) => b.paid_at.localeCompare(a.paid_at))
          .map((item) => ({ ...item, dateKey: item.paid_at })),
      ),
    [filtered],
  );

  if (items.length === 0) {
    return <CreditCardFeedEmpty message={emptyText} />;
  }

  return (
    <div role="region" aria-label={regionLabel} className="space-y-4">
      {showSearch ? (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar…"
          className="h-9 border-border/60 bg-muted/20 text-sm"
          aria-label={`Filtrar: ${regionLabel}`}
        />
      ) : null}

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay pagos que coincidan con el filtro.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map(([dateKey, dayItems]) => (
            <section key={dateKey} aria-label={getDateGroupLabel(dateKey)}>
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {getDateGroupLabel(dateKey)}
              </h4>
              <ul className="space-y-1">
                {dayItems.map((payment) => (
                  <li key={payment.id}>
                    <div className="flex items-center gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-muted/30">
                      <WalletIdentity
                        name={payment.source_wallet_name}
                        providerIconKey={payment.source_wallet_provider_icon_key}
                        className="shrink-0"
                        iconClassName="h-10 w-10 rounded-full ring-1 ring-border/40"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {payment.source_wallet_name}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          Pago a tarjeta
                          {payment.note ? ` · ${payment.note}` : ''}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 font-mono text-sm font-bold tabular-nums',
                          'text-emerald-600 dark:text-emerald-400',
                        )}
                      >
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
