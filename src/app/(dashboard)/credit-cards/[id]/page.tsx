'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import CreditCardPaymentDialog from '@/components/credit-cards/CreditCardPaymentDialog';
import CreditCardQuickPurchaseDialog from '@/components/credit-cards/CreditCardQuickPurchaseDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useFinanceContext } from '@/context/finance-context';
import {
  buildOwnerQuery,
  clientFetchFromApi,
  createCreditCardPayment,
  getCreditCardStatement,
  getPaymentMethodOptions,
} from '@/lib/api';
import type { CreditCardPaymentSubmitPayload } from '@/components/credit-cards/CreditCardPaymentDialog';
import { downloadCreditCardStatementCsv } from '@/lib/finance/credit-card-statement-csv';
import { downloadCreditCardStatementPdf } from '@/lib/finance/credit-card-statement-pdf';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type {
  CategoryOption,
  CreditCardListItem,
  CreditCardPaymentListItem,
  CreditCardStatementPurchaseItem,
  CreditCardStatementResponse,
  PaymentMethodOption,
} from '@/types/catalog';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const shiftDateByDays = (dateStr: string, days: number): string => {
  const date = new Date(dateStr + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
};

const formatCycleRange = (start: string, end: string) =>
  `${formatDate(start)} – ${formatDate(end)}`;

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
        (i) =>
          i.description.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      )
    : [...items];
  const m = dir === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    if (field === 'amount') return m * (a.amount - b.amount);
    if (field === 'description') {
      return m * a.description.localeCompare(b.description, 'es');
    }
    if (field === 'category') {
      return m * a.category.localeCompare(b.category, 'es');
    }
    return m * a.payment_date.localeCompare(b.payment_date);
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
        (i) =>
          i.source_wallet_name.toLowerCase().includes(q) ||
          (i.note?.toLowerCase().includes(q) ?? false),
      )
    : [...items];
  const m = dir === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    if (field === 'amount') return m * (a.amount - b.amount);
    if (field === 'source_wallet_name') {
      return m * a.source_wallet_name.localeCompare(b.source_wallet_name, 'es');
    }
    return m * a.paid_at.localeCompare(b.paid_at);
  });
  return rows;
};

const fortnightHref = (
  p: CreditCardStatementPurchaseItem,
  ownerQueryString: string,
) =>
  `/fortnight/${p.fortnight_year}/${String(p.fortnight_month).padStart(2, '0')}/${p.fortnight_period}${ownerQueryString}`;

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
  onSort: (k: PurchaseSortField) => void;
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
  onSort: (k: PaymentSortField) => void;
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

const CreditCardDetailSkeleton = () => (
  <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
    <Skeleton className="mx-auto h-10 w-64 max-w-full" />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Skeleton className="h-56 rounded-xl lg:col-span-1" />
      <Skeleton className="h-56 rounded-xl lg:col-span-2" />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  </div>
);

type PurchaseTableProps = {
  items: CreditCardStatementPurchaseItem[];
  emptyText: string;
  ownerQueryString: string;
  regionLabel: string;
};

const PurchaseTableBlock = ({
  items,
  emptyText,
  ownerQueryString,
  regionLabel,
}: PurchaseTableProps) => {
  const [query, setQuery] = useState('');
  const [field, setField] = useState<PurchaseSortField>('payment_date');
  const [dir, setDir] = useState<SortDir>('desc');

  const sorted = useMemo(
    () => sortPurchases(items, field, dir, query),
    [items, field, dir, query],
  );

  const handleSortClick = (next: PurchaseSortField) => {
    if (field === next) {
      setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setField(next);
    setDir(next === 'payment_date' || next === 'amount' ? 'desc' : 'asc');
  };

  return (
    <div role="region" aria-label={regionLabel} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por descripción o categoría…"
          className="max-w-sm text-sm"
          aria-label={`Filtrar: ${regionLabel}`}
        />
        <div
          className="flex flex-wrap gap-0.5"
          role="group"
          aria-label="Ordenar compras"
        >
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
        <ul className="space-y-2">
          {sorted.map((purchase) => (
            <li
              key={purchase.id}
              className="rounded-md border border-border/60 px-3 py-2"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{purchase.description}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {purchase.category} · {formatDate(purchase.payment_date)}
                  </p>
                  <Link
                    href={fortnightHref(purchase, ownerQueryString)}
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
      )}
    </div>
  );
};

type PaymentTableProps = {
  items: CreditCardPaymentListItem[];
  regionLabel: string;
};

const PaymentTableBlock = ({ items, regionLabel }: PaymentTableProps) => {
  const [query, setQuery] = useState('');
  const [field, setField] = useState<PaymentSortField>('paid_at');
  const [dir, setDir] = useState<SortDir>('desc');

  const sorted = useMemo(
    () => sortPayments(items, field, dir, query),
    [items, field, dir, query],
  );

  const handleSortClick = (next: PaymentSortField) => {
    if (field === next) {
      setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setField(next);
    setDir(next === 'paid_at' || next === 'amount' ? 'desc' : 'asc');
  };

  return (
    <div role="region" aria-label={regionLabel} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por billetera origen o nota…"
          className="max-w-sm text-sm"
          aria-label={`Filtrar: ${regionLabel}`}
        />
        <div
          className="flex flex-wrap gap-0.5"
          role="group"
          aria-label="Ordenar pagos"
        >
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
        <p className="text-sm text-muted-foreground">
          Todavía no hay pagos registrados.
        </p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay pagos que coincidan con el filtro.
        </p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((payment) => (
            <li
              key={payment.id}
              className="rounded-md border border-border/60 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    Desde {payment.source_wallet_name}
                  </p>
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
      )}
    </div>
  );
};

export default function CreditCardDetailPage() {
  const params = useParams<{ id: string }>();
  const { context } = useFinanceContext();
  const creditCardId = Number(params.id);

  const [card, setCard] = useState<CreditCardListItem | null>(null);
  const [statement, setStatement] =
    useState<CreditCardStatementResponse | null>(null);
  const [paymentSources, setPaymentSources] = useState<PaymentMethodOption[]>(
    [],
  );
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [asOfDate, setAsOfDate] = useState(getTodayDateString());

  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  const fundingWalletOptions = useMemo(
    () =>
      paymentSources.filter(
        (wallet) => wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD',
      ),
    [paymentSources],
  );

  const loadData = useCallback(async () => {
    if (!Number.isFinite(creditCardId)) {
      setError('Tarjeta inválida');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [cardData, statementData, paymentMethodsData, categoriesData] =
        await Promise.all([
          clientFetchFromApi<CreditCardListItem>(
            `/api/credit-cards/${creditCardId}`,
            undefined,
            context,
          ),
          getCreditCardStatement(creditCardId, context, asOfDate),
          getPaymentMethodOptions(context),
          clientFetchFromApi<CategoryOption[]>(
            '/api/categories',
            undefined,
            context,
          ),
        ]);

      setCard(cardData);
      setStatement(statementData);
      setPaymentSources(paymentMethodsData);
      setCategoryOptions(categoriesData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al cargar el estado de cuenta',
      );
    } finally {
      setLoading(false);
    }
  }, [asOfDate, context, creditCardId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePaymentSubmit = async (data: CreditCardPaymentSubmitPayload) => {
    try {
      setPaymentSubmitting(true);
      setPaymentError(null);

      await createCreditCardPayment(creditCardId, data, context);

      toast.success('Pago registrado');
      setPaymentDialogOpen(false);
      await loadData();
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : 'Error al registrar el pago',
      );
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const isCurrentCycle = useMemo(() => {
    if (!statement) return true;
    const today = getTodayDateString();
    return (
      today >= statement.current_cycle_start &&
      today <= statement.current_cycle_end
    );
  }, [statement]);

  const handlePreviousCycle = useCallback(() => {
    if (!statement) return;
    setAsOfDate(shiftDateByDays(statement.statement_start, -1));
  }, [statement]);

  const handleNextCycle = useCallback(() => {
    if (!statement) return;
    setAsOfDate(shiftDateByDays(statement.current_cycle_end, 1));
  }, [statement]);

  const handleResetToToday = useCallback(() => {
    setAsOfDate(getTodayDateString());
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!card || !statement) return;
    try {
      downloadCreditCardStatementCsv(card.name, statement);
      toast.success('CSV descargado');
    } catch {
      toast.error('No se pudo exportar el CSV');
    }
  }, [card, statement]);

  const handleExportPdf = useCallback(() => {
    if (!card || !statement) return;
    try {
      downloadCreditCardStatementPdf(card.name, statement);
      toast.success('PDF descargado');
    } catch {
      toast.error('No se pudo exportar el PDF');
    }
  }, [card, statement]);

  if (loading && !statement) {
    return <CreditCardDetailSkeleton />;
  }

  if (error || !card || !statement) {
    return (
      <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
        {error ?? 'No se pudo cargar la tarjeta'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
            <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">{card.name}</h1>
            <p className="text-xs text-muted-foreground">
              Corte día {card.cutoff_day} · Pago día {card.due_day}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            aria-label="Exportar periodo visible a CSV"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleExportPdf}
            aria-label="Exportar periodo visible a PDF"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => setPurchaseDialogOpen(true)}
          >
            <ShoppingCart className="h-4 w-4" />
            Registrar compra
          </Button>
          <Button onClick={() => setPaymentDialogOpen(true)}>
            <Wallet className="h-4 w-4" />
            Registrar pago
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePreviousCycle}
          aria-label="Ciclo anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-0 text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Ciclo actual
          </p>
          <p className="text-sm font-semibold tabular-nums">
            {formatCycleRange(statement.current_cycle_start, statement.current_cycle_end)}
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextCycle}
          disabled={isCurrentCycle}
          aria-label="Ciclo siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {!isCurrentCycle && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToToday}
            aria-label="Volver al ciclo actual"
            className="ml-1 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Hoy
          </Button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-l-[3px] border-l-violet-500/50 bg-violet-500/5 px-3 py-3 dark:bg-violet-500/8">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Deuda actual
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {formatCurrency(statement.outstanding_balance)}
          </p>
        </div>
        <div className="rounded-lg border border-l-[3px] border-l-emerald-500/50 bg-emerald-500/5 px-3 py-3 dark:bg-emerald-500/8">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Crédito disponible
          </p>
          <p
            className={cn(
              'text-2xl font-bold font-mono tabular-nums',
              (statement.available_credit ?? 0) < 0 && 'text-destructive',
            )}
          >
            {statement.available_credit == null
              ? 'Sin línea'
              : formatCurrency(statement.available_credit)}
          </p>
        </div>
        <div className="rounded-lg border border-l-[3px] border-l-amber-500/50 bg-amber-500/5 px-3 py-3 dark:bg-amber-500/8">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pago próximo
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {formatCurrency(statement.next_due_payment)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Vence el {formatDate(statement.statement_due_date)}
          </p>
        </div>
        <div className="rounded-lg border border-l-[3px] border-l-blue-500/50 bg-blue-500/5 px-3 py-3 dark:bg-blue-500/8">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Compras del ciclo
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums">
            {formatCurrency(statement.current_cycle_purchases)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Pagos del ciclo {formatCurrency(statement.current_cycle_payments)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden border-border/60 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Resumen del estado de cuenta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Receipt className="mt-0.5 h-4 w-4 text-violet-500" />
              <div>
                <p className="text-muted-foreground">Periodo facturado</p>
                <p>
                  {formatDate(statement.statement_start)} al{' '}
                  {formatDate(statement.statement_end)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Landmark className="mt-0.5 h-4 w-4 text-blue-500" />
              <div>
                <p className="text-muted-foreground">Saldo del corte</p>
                <p className="font-mono tabular-nums">
                  {formatCurrency(statement.last_statement_balance)}
                </p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Pagos desde el corte</p>
              <p className="font-mono tabular-nums">
                {formatCurrency(statement.payments_since_last_cutoff)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Pagos aplicados al corte</p>
              <p className="font-mono tabular-nums">
                {formatCurrency(statement.payments_applied_to_statement)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Compras del ciclo actual
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statement.current_cycle_purchase_items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay compras en el ciclo actual. Usa{' '}
                <span className="font-medium text-foreground">
                  Registrar compra
                </span>{' '}
                arriba o registra un gasto en la planificación mensual con esta
                tarjeta como método de pago.
              </p>
            ) : (
              <PurchaseTableBlock
                items={statement.current_cycle_purchase_items}
                emptyText="No hay compras que coincidan con el filtro."
                ownerQueryString={ownerQueryString}
                regionLabel="Compras del ciclo actual"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Compras del último corte
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statement.statement_purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hubo compras en el último corte.
              </p>
            ) : (
              <PurchaseTableBlock
                items={statement.statement_purchases}
                emptyText="No hay compras que coincidan con el filtro."
                ownerQueryString={ownerQueryString}
                regionLabel="Compras del último corte"
              />
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Historial de pagos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentTableBlock
              items={statement.payment_history}
              regionLabel="Historial de pagos"
            />
          </CardContent>
        </Card>
      </div>

      <CreditCardPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) setPaymentError(null);
        }}
        fundingWalletOptions={fundingWalletOptions}
        categoryOptions={categoryOptions}
        nextDuePayment={statement.next_due_payment}
        outstandingBalance={statement.outstanding_balance}
        submitting={paymentSubmitting}
        error={paymentError}
        onSubmit={handlePaymentSubmit}
      />

      <CreditCardQuickPurchaseDialog
        open={purchaseDialogOpen}
        onOpenChange={setPurchaseDialogOpen}
        creditCardId={creditCardId}
        context={context}
        onSuccess={loadData}
        availableCredit={statement.available_credit}
        creditLimit={statement.credit_limit}
      />
    </div>
  );
}
