'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  MoreHorizontal,
  Search,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CategoryLabel } from '@/components/categories/CategoryLabel';
import { CreditCardFeedEmpty } from '@/components/credit-cards/CreditCardTransactionFeed';
import {
  buildCreditCardCycleLedger,
  filterCycleLedger,
  isInstallmentPurchase,
  searchCycleLedger,
  type CycleLedgerFilter,
} from '@/lib/finance/credit-card-cycle-ledger';
import type { CreditCardCycleReconciliation } from '@/lib/finance/credit-card-cycle-reconciliation';
import type {
  CreditCardStatementImportListItem,
  CreditCardStatementPurchaseItem,
  CreditCardPaymentListItem,
} from '@/types/catalog';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const getDateGroupLabel = (dateStr: string): string => {
  const day = dateStr.slice(0, 10);
  const today = getTodayDateString();
  if (day === today) return 'Hoy';

  const yesterday = new Date(today + 'T12:00:00Z');
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (day === yesterday.toISOString().split('T')[0]) return 'Ayer';

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

const FILTER_OPTIONS: { value: CycleLedgerFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'purchases', label: 'Compras' },
  { value: 'payments', label: 'Pagos' },
  { value: 'msi', label: 'MSI / cuotas' },
  { value: 'imports', label: 'Importaciones' },
];

type CreditCardCycleLedgerProps = {
  cycleStart: string;
  cycleEnd: string;
  statementEnd: string;
  cyclePurchases: CreditCardStatementPurchaseItem[];
  payments: CreditCardPaymentListItem[];
  imports: CreditCardStatementImportListItem[];
  ownerQueryString: string;
  reconciliation?: CreditCardCycleReconciliation | null;
  onRegisterPurchase: () => void;
  onRegisterPayment: () => void;
  onGoToCuotas?: () => void;
};

export const CreditCardCycleLedger = ({
  cycleStart,
  cycleEnd,
  statementEnd,
  cyclePurchases,
  payments,
  imports,
  ownerQueryString,
  reconciliation,
  onRegisterPurchase,
  onRegisterPayment,
  onGoToCuotas,
}: CreditCardCycleLedgerProps) => {
  const [filter, setFilter] = useState<CycleLedgerFilter>('all');
  const [query, setQuery] = useState('');

  const allEntries = useMemo(
    () =>
      buildCreditCardCycleLedger({
        cycleStart,
        cycleEnd,
        statementEnd,
        cyclePurchases,
        payments,
        imports,
      }),
    [cycleStart, cycleEnd, statementEnd, cyclePurchases, payments, imports],
  );

  const filtered = useMemo(() => {
    const byFilter = filterCycleLedger(allEntries, filter);
    return searchCycleLedger(byFilter, query);
  }, [allEntries, filter, query]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const activeFilterLabel =
    FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? 'Todos';

  const showReconciliationHint =
    reconciliation != null && reconciliation.status === 'needs_review';

  if (allEntries.length === 0) {
    return (
      <CreditCardFeedEmpty
        message="Sin movimientos en este ciclo"
        description="Registra compras o pagos para ver la actividad del periodo."
        action={{ label: 'Registrar compra', onClick: onRegisterPurchase }}
      />
    );
  }

  return (
    <div
      role="region"
      aria-label="Movimientos del ciclo"
      className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
    >
      <div className="border-b border-border/50 bg-linear-to-br from-muted/25 via-card to-card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-foreground">
              Movimientos del ciclo
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {allEntries.length} movimiento{allEntries.length === 1 ? '' : 's'} ·{' '}
              {activeFilterLabel.toLowerCase()}
            </p>
            {showReconciliationHint ? (
              <p className="mt-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                Hay diferencias con el import — revisa en Resumen.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar movimientos..."
                className="h-9 rounded-xl border-border/60 bg-background/80 pl-9 text-sm"
                aria-label="Buscar movimientos del ciclo"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-xl"
                  aria-label="Filtrar movimientos"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                  Filtros
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Tipo de movimiento</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {FILTER_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={filter === option.value}
                    onCheckedChange={() => setFilter(option.value)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-4">
          <CreditCardFeedEmpty message="Ningún resultado con el filtro aplicado." />
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {grouped.map(([dateKey, rows]) => (
            <section key={dateKey} aria-label={getDateGroupLabel(dateKey)}>
              <p className="sticky top-0 z-[1] bg-card/95 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                {getDateGroupLabel(dateKey)}
              </p>
              <ul className="px-2 pb-2">
                {rows.map((entry) => {
                  if (entry.kind === 'purchase') {
                    const { purchase } = entry;
                    const msi = isInstallmentPurchase(purchase);
                    return (
                      <li key={entry.id}>
                        <Link
                          href={getFortnightHref(purchase, ownerQueryString)}
                          className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/40"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                            <ArrowUpRight className="h-4 w-4" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">{purchase.description}</p>
                              {msi ? (
                                <Badge
                                  variant="secondary"
                                  className="h-5 shrink-0 px-1.5 text-[10px] font-mono"
                                >
                                  {purchase.credit_installment_current}/{purchase.credit_installment_total}
                                </Badge>
                              ) : null}
                            </div>
                            <CategoryLabel
                              name={purchase.category}
                              icon={purchase.categoryIcon}
                              className="text-[11px] text-muted-foreground"
                            />
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-mono text-sm font-semibold tabular-nums text-destructive">
                              −{formatCurrency(purchase.amount)}
                            </p>
                            {msi && onGoToCuotas ? (
                              <button
                                type="button"
                                className="text-[10px] text-primary hover:underline"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onGoToCuotas();
                                }}
                              >
                                Ver en Cuotas
                              </button>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    );
                  }

                  if (entry.kind === 'payment') {
                    const { payment } = entry;
                    return (
                      <li
                        key={entry.id}
                        className="flex items-center gap-3 rounded-xl px-2 py-2.5"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <ArrowDownLeft className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            Pago desde {payment.source_wallet_name}
                          </p>
                          {payment.note ? (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {payment.note}
                            </p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">Pago registrado</p>
                          )}
                        </div>
                        <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                          +{formatCurrency(payment.amount)}
                        </p>
                      </li>
                    );
                  }

                  const { importRecord } = entry;
                  return (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <FileText className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">Importación de estado de cuenta</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {importRecord.file_name ?? importRecord.provider} ·{' '}
                          {importRecord.expense_count} gasto
                          {importRecord.expense_count === 1 ? '' : 's'}
                        </p>
                      </div>
                      {importRecord.total_due != null ? (
                        <p className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                          {formatCurrency(importRecord.total_due)}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <div className="flex gap-2 border-t border-border/50 p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 flex-1 rounded-xl"
          onClick={onRegisterPurchase}
        >
          <Wallet className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Compra
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-9 flex-1 rounded-xl"
          onClick={onRegisterPayment}
        >
          Registrar pago
        </Button>
      </div>
    </div>
  );
};
