'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate } from '@/lib/utils';
import type {
  CreditCardPaymentListItem,
  CreditCardStatementPurchaseItem,
} from '@/types/catalog';

/** Listas dentro de tarjetas: altura máxima y scroll vertical. */
const CREDIT_CARD_DETAIL_LIST_SCROLL_CLASS =
  'max-h-[min(20rem,45vh)] overflow-y-auto scrollbar-hide pr-0.5';

type SortDir = 'asc' | 'desc';
type PurchaseSortField = 'payment_date' | 'amount' | 'description' | 'category';
type PaymentSortField = 'paid_at' | 'amount' | 'source_wallet_name';

const sortPurchases = (
  items: CreditCardStatementPurchaseItem[],
  field: PurchaseSortField,
  dir: SortDir,
  query: string,
): CreditCardStatementPurchaseItem[] => {
  const q = query.trim().toLowerCase();
  const rows = q
    ? items.filter(
        (item) =>
          item.description.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q),
      )
    : [...items];

  const multiplier = dir === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    if (field === 'amount') return multiplier * (a.amount - b.amount);
    if (field === 'description') {
      return multiplier * a.description.localeCompare(b.description, 'es');
    }
    if (field === 'category') {
      return multiplier * a.category.localeCompare(b.category, 'es');
    }
    return multiplier * a.payment_date.localeCompare(b.payment_date);
  });

  return rows;
};

const sortPayments = (
  items: CreditCardPaymentListItem[],
  field: PaymentSortField,
  dir: SortDir,
  query: string,
): CreditCardPaymentListItem[] => {
  const q = query.trim().toLowerCase();
  const rows = q
    ? items.filter(
        (item) =>
          item.source_wallet_name.toLowerCase().includes(q) ||
          (item.note?.toLowerCase().includes(q) ?? false),
      )
    : [...items];

  const multiplier = dir === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    if (field === 'amount') return multiplier * (a.amount - b.amount);
    if (field === 'source_wallet_name') {
      return (
        multiplier * a.source_wallet_name.localeCompare(b.source_wallet_name, 'es')
      );
    }
    return multiplier * a.paid_at.localeCompare(b.paid_at);
  });

  return rows;
};

const getFortnightHref = (
  purchase: CreditCardStatementPurchaseItem,
  ownerQueryString: string,
) =>
  `/fortnight/${purchase.fortnight_year}/${String(purchase.fortnight_month).padStart(2, '0')}/${purchase.fortnight_period}${ownerQueryString}`;

const PurchaseSortButton = ({
  sortKey,
  label,
  activeKey,
  dir,
  onSort,
}: {
  sortKey: PurchaseSortField;
  label: string;
  activeKey: PurchaseSortField;
  dir: SortDir;
  onSort: (sortField: PurchaseSortField) => void;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className="h-7 px-1.5 text-[10px] font-semibold uppercase tracking-wider"
    onClick={() => onSort(sortKey)}
    aria-label={`Ordenar por ${label}${
      activeKey === sortKey ? (dir === 'desc' ? ', descendente' : ', ascendente') : ''
    }`}
  >
    {label}
    {activeKey === sortKey &&
      (dir === 'desc' ? (
        <ArrowDown className="ml-0.5 h-3 w-3" />
      ) : (
        <ArrowUp className="ml-0.5 h-3 w-3" />
      ))}
  </Button>
);

const PaymentSortButton = ({
  sortKey,
  label,
  activeKey,
  dir,
  onSort,
}: {
  sortKey: PaymentSortField;
  label: string;
  activeKey: PaymentSortField;
  dir: SortDir;
  onSort: (sortField: PaymentSortField) => void;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className="h-7 px-1.5 text-[10px] font-semibold uppercase tracking-wider"
    onClick={() => onSort(sortKey)}
    aria-label={`Ordenar pagos por ${label}`}
  >
    {label}
    {activeKey === sortKey &&
      (dir === 'desc' ? (
        <ArrowDown className="ml-0.5 h-3 w-3" />
      ) : (
        <ArrowUp className="ml-0.5 h-3 w-3" />
      ))}
  </Button>
);

type PurchaseTableProps = {
  items: CreditCardStatementPurchaseItem[];
  emptyText: string;
  ownerQueryString: string;
  regionLabel: string;
  listScrollClassName?: string;
};

export const PurchaseTableBlock = ({
  items,
  emptyText,
  ownerQueryString,
  regionLabel,
  listScrollClassName = CREDIT_CARD_DETAIL_LIST_SCROLL_CLASS,
}: PurchaseTableProps) => {
  const [query, setQuery] = useState('');
  const [field, setField] = useState<PurchaseSortField>('payment_date');
  const [dir, setDir] = useState<SortDir>('desc');

  const sorted = useMemo(
    () => sortPurchases(items, field, dir, query),
    [items, field, dir, query],
  );

  const handleSortClick = (nextField: PurchaseSortField) => {
    if (field === nextField) {
      setDir((currentDir) => (currentDir === 'desc' ? 'asc' : 'desc'));
      return;
    }

    setField(nextField);
    setDir(nextField === 'payment_date' || nextField === 'amount' ? 'desc' : 'asc');
  };

  return (
    <div role="region" aria-label={regionLabel} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por descripción o categoría…"
          className="max-w-sm text-sm"
          aria-label={`Filtrar: ${regionLabel}`}
        />
        <div className="flex flex-wrap gap-0.5" role="group" aria-label="Ordenar compras">
          <PurchaseSortButton
            sortKey="payment_date"
            label="Fecha"
            activeKey={field}
            dir={dir}
            onSort={handleSortClick}
          />
          <PurchaseSortButton
            sortKey="amount"
            label="Monto"
            activeKey={field}
            dir={dir}
            onSort={handleSortClick}
          />
          <PurchaseSortButton
            sortKey="description"
            label="Concepto"
            activeKey={field}
            dir={dir}
            onSort={handleSortClick}
          />
          <PurchaseSortButton
            sortKey="category"
            label="Categoría"
            activeKey={field}
            dir={dir}
            onSort={handleSortClick}
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className={listScrollClassName}>
          <ul className="space-y-2">
            {sorted.map((purchase) => (
              <li
                key={purchase.id}
                className="rounded-md border border-border/60 px-3 py-2"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {purchase.description}
                      {purchase.credit_installment_current != null &&
                      purchase.credit_installment_total != null ? (
                        <span
                          className="ml-1.5 inline-flex align-middle items-center rounded-md border border-border/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
                          title="Compra en cuotas"
                        >
                          Cuota {purchase.credit_installment_current}/
                          {purchase.credit_installment_total}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {purchase.category} · {formatDate(purchase.payment_date)}
                    </p>
                    <Link
                      href={getFortnightHref(purchase, ownerQueryString)}
                      className="text-[10px] font-medium text-primary underline-offset-2 hover:underline"
                    >
                      Ver en quincena
                    </Link>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                    {formatCurrency(purchase.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

type PaymentTableProps = {
  items: CreditCardPaymentListItem[];
  regionLabel: string;
  listScrollClassName?: string;
};

export const PaymentTableBlock = ({
  items,
  regionLabel,
  listScrollClassName = CREDIT_CARD_DETAIL_LIST_SCROLL_CLASS,
}: PaymentTableProps) => {
  const [query, setQuery] = useState('');
  const [field, setField] = useState<PaymentSortField>('paid_at');
  const [dir, setDir] = useState<SortDir>('desc');

  const sorted = useMemo(
    () => sortPayments(items, field, dir, query),
    [items, field, dir, query],
  );

  const handleSortClick = (nextField: PaymentSortField) => {
    if (field === nextField) {
      setDir((currentDir) => (currentDir === 'desc' ? 'asc' : 'desc'));
      return;
    }

    setField(nextField);
    setDir(nextField === 'paid_at' || nextField === 'amount' ? 'desc' : 'asc');
  };

  return (
    <div role="region" aria-label={regionLabel} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por billetera origen o nota…"
          className="max-w-sm text-sm"
          aria-label={`Filtrar: ${regionLabel}`}
        />
        <div className="flex flex-wrap gap-0.5" role="group" aria-label="Ordenar pagos">
          <PaymentSortButton
            sortKey="paid_at"
            label="Fecha"
            activeKey={field}
            dir={dir}
            onSort={handleSortClick}
          />
          <PaymentSortButton
            sortKey="amount"
            label="Monto"
            activeKey={field}
            dir={dir}
            onSort={handleSortClick}
          />
          <PaymentSortButton
            sortKey="source_wallet_name"
            label="Origen"
            activeKey={field}
            dir={dir}
            onSort={handleSortClick}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay pagos registrados.</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay pagos que coincidan con el filtro.
        </p>
      ) : (
        <div className={listScrollClassName}>
          <ul className="space-y-2">
            {sorted.map((payment) => (
              <li
                key={payment.id}
                className="rounded-md border border-border/60 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Desde {payment.source_wallet_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(payment.paid_at)}
                      {payment.note ? ` · ${payment.note}` : ''}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
