'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Receipt,
  RotateCcw,
  ShoppingCart,
  Upload,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import CreditCardStatementImportDialog from '@/components/credit-cards/CreditCardStatementImportDialog';
import { CreditCardPaymentsChart } from '@/components/credit-cards/CreditCardPaymentsChart';
import CreditCardPaymentDialog from '@/components/credit-cards/CreditCardPaymentDialog';
import CreditCardQuickPurchaseDialog from '@/components/credit-cards/CreditCardQuickPurchaseDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useFinanceContext } from '@/context/finance-context';
import {
  buildOwnerQuery,
  clientFetchFromApi,
  createCreditCardPayment,
  downloadCreditCardStatementImportFile,
  getCreditCardStatement,
  getPaymentMethodOptions,
  listCreditCardStatementImports,
  rollbackCreditCardStatementImport,
} from '@/lib/api';
import type { CreditCardPaymentSubmitPayload } from '@/components/credit-cards/CreditCardPaymentDialog';
import { downloadCreditCardStatementCsv } from '@/lib/finance/credit-card-statement-csv';
import { downloadCreditCardStatementPdf } from '@/lib/finance/credit-card-statement-pdf';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type {
  CategoryOption,
  CreditCardListItem,
  CreditCardPaymentListItem,
  CreditCardStatementImportListItem,
  CreditCardStatementPurchaseItem,
  CreditCardStatementResponse,
  PaymentMethodOption,
} from '@/types/catalog';

/** Listas dentro de tarjetas en esta página: altura máxima y scroll vertical. */
const CREDIT_CARD_DETAIL_LIST_SCROLL_CLASS =
  'max-h-[min(20rem,45vh)] overflow-y-auto scrollbar-hide pr-0.5';

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
      <div className="flex flex-wrap justify-end gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-32 rounded-xl" />
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
  listScrollClassName?: string;
};

const PurchaseTableBlock = ({
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
                      {purchase.credit_msi_current != null &&
                      purchase.credit_msi_total != null ? (
                        <span
                          className="ml-1.5 inline-flex align-middle items-center rounded-md border border-border/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground"
                          title="Meses sin intereses"
                        >
                          MSI {purchase.credit_msi_current}/
                          {purchase.credit_msi_total}
                        </span>
                      ) : null}
                    </p>
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

const PaymentTableBlock = ({
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
        <div className={listScrollClassName}>
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
        </div>
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
  const [statementImports, setStatementImports] = useState<
    CreditCardStatementImportListItem[]
  >([]);
  const [mpImportDialogOpen, setMpImportDialogOpen] = useState(false);
  const [rollbackImportId, setRollbackImportId] = useState<number | null>(null);

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
    if (context.id === 0) {
      return;
    }

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

      let importsData: CreditCardStatementImportListItem[] = [];
      try {
        importsData = await listCreditCardStatementImports(
          creditCardId,
          context,
        );
      } catch {
        importsData = [];
      }

      setCard(cardData);
      setStatement(statementData);
      setPaymentSources(paymentMethodsData);
      setCategoryOptions(categoriesData);
      setStatementImports(importsData);
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

  const handleDownloadStatementImport = useCallback(
    async (importId: number) => {
      try {
        await downloadCreditCardStatementImportFile(
          creditCardId,
          importId,
          context,
        );
        toast.success('PDF descargado');
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'No se pudo descargar el archivo',
        );
      }
    },
    [context, creditCardId],
  );

  const rollbackImportSummary = useMemo(() => {
    if (rollbackImportId == null) return null;
    return statementImports.find((r) => r.id === rollbackImportId) ?? null;
  }, [rollbackImportId, statementImports]);

  const handleConfirmRollbackImport = useCallback(async () => {
    if (rollbackImportId == null) return;
    try {
      const res = await rollbackCreditCardStatementImport(
        creditCardId,
        rollbackImportId,
        context,
      );
      toast.success(
        res.expenses_removed > 0
          ? `Importación revertida: ${res.expenses_removed} gasto(s) eliminado(s).`
          : 'Importación eliminada.',
      );
      setRollbackImportId(null);
      await loadData();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo revertir la importación',
      );
      throw err;
    }
  }, [context, creditCardId, loadData, rollbackImportId]);

  const daysUntilDue = useMemo(() => {
    if (!statement) return 0;
    const today = new Date(getTodayDateString() + 'T12:00:00Z');
    const due = new Date(statement.statement_due_date + 'T12:00:00Z');
    return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [statement]);

  const utilizationPct = useMemo((): number | null => {
    if (!statement?.credit_limit || statement.credit_limit === 0) return null;
    return Math.min(
      100,
      Math.round((statement.outstanding_balance / statement.credit_limit) * 100),
    );
  }, [statement]);

  if (context.id === 0 || (loading && !statement)) {
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
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────── */}
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-1.5 self-start sm:self-auto"
              aria-label="Más acciones"
            >
              <ChevronDown className="h-4 w-4 opacity-70" />
              Más
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem
              onClick={() => setMpImportDialogOpen(true)}
              className="cursor-pointer"
            >
              <Upload className="mr-2 h-4 w-4 shrink-0" />
              Importar PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportCsv}
              className="cursor-pointer"
            >
              <Download className="mr-2 h-4 w-4 shrink-0" />
              Exportar CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportPdf}
              className="cursor-pointer"
            >
              <FileText className="mr-2 h-4 w-4 shrink-0" />
              Exportar PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Hero: pago próximo ─────────────────────────────────────── */}
      <div
        className={cn(
          'rounded-xl border-2 p-5 transition-colors',
          daysUntilDue < 0
            ? 'border-destructive/60 bg-destructive/5'
            : daysUntilDue <= 5
              ? 'border-amber-500/60 bg-amber-500/5'
              : daysUntilDue <= 10
                ? 'border-yellow-500/40 bg-yellow-500/5'
                : 'border-border/60 bg-card',
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pago próximo
            </p>
            <p className="text-4xl font-bold font-mono tabular-nums">
              {formatCurrency(statement.next_due_payment)}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'gap-1.5 text-xs font-medium',
                  daysUntilDue < 0
                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                    : daysUntilDue <= 5
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : daysUntilDue <= 10
                        ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                        : 'border-border/60 text-muted-foreground',
                )}
              >
                <CalendarClock className="h-3 w-3" />
                {daysUntilDue < 0
                  ? `Vencido hace ${Math.abs(daysUntilDue)} día${Math.abs(daysUntilDue) === 1 ? '' : 's'}`
                  : daysUntilDue === 0
                    ? 'Vence hoy'
                    : `Vence en ${daysUntilDue} día${daysUntilDue === 1 ? '' : 's'}`}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(statement.statement_due_date)}
              </span>
              {statement.minimum_payment != null &&
                statement.minimum_payment !== statement.next_due_payment && (
                  <span className="text-xs text-muted-foreground">
                    Mínimo: {formatCurrency(statement.minimum_payment)}
                  </span>
                )}
            </div>
            {utilizationPct != null && (
              <div className="max-w-xs space-y-1 pt-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Utilización de crédito</span>
                  <span className="font-mono tabular-nums">{utilizationPct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      utilizationPct > 80
                        ? 'bg-destructive'
                        : utilizationPct > 50
                          ? 'bg-amber-500'
                          : 'bg-emerald-500',
                    )}
                    style={{ width: `${utilizationPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
            <Button
              type="button"
              className="gap-2 rounded-xl shadow-sm"
              onClick={() => setPaymentDialogOpen(true)}
            >
              <Wallet className="h-4 w-4 shrink-0" />
              Registrar pago
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setPurchaseDialogOpen(true)}
            >
              <ShoppingCart className="h-4 w-4 shrink-0" />
              Registrar compra
            </Button>
          </div>
        </div>
      </div>

      {/* ── Cycle nav + compact stats ──────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 self-start rounded-lg border border-border/60 bg-muted/40 px-1 py-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePreviousCycle}
            aria-label="Ciclo anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-0 px-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ciclo
            </p>
            <p className="text-xs font-semibold tabular-nums">
              {formatCycleRange(
                statement.current_cycle_start,
                statement.current_cycle_end,
              )}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextCycle}
            disabled={isCurrentCycle}
            aria-label="Ciclo siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          {!isCurrentCycle && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-1.5 text-[10px]"
              onClick={handleResetToToday}
              aria-label="Volver al ciclo actual"
            >
              <RotateCcw className="h-3 w-3" />
              Hoy
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-lg border border-l-[3px] border-l-violet-500/50 bg-violet-500/5 px-3 py-2 dark:bg-violet-500/8">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Deuda actual
            </p>
            <p className="text-sm font-bold font-mono tabular-nums">
              {formatCurrency(statement.outstanding_balance)}
            </p>
          </div>
          <div className="rounded-lg border border-l-[3px] border-l-emerald-500/50 bg-emerald-500/5 px-3 py-2 dark:bg-emerald-500/8">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Disponible
            </p>
            <p
              className={cn(
                'text-sm font-bold font-mono tabular-nums',
                (statement.available_credit ?? 0) < 0 && 'text-destructive',
              )}
            >
              {statement.available_credit == null
                ? 'Sin línea'
                : formatCurrency(statement.available_credit)}
            </p>
          </div>
          <div className="rounded-lg border border-l-[3px] border-l-blue-500/50 bg-blue-500/5 px-3 py-2 dark:bg-blue-500/8">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Compras ciclo
            </p>
            <p className="text-sm font-bold font-mono tabular-nums">
              {formatCurrency(statement.current_cycle_purchases)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Chart + Statement summary ──────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CreditCardPaymentsChart
            paymentHistory={statement.payment_history}
            msiActivePurchases={statement.msi_active_purchases}
            statementEnd={statement.statement_end}
          />
        </div>
        <Card className="overflow-hidden border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Estado de cuenta
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/40 p-0 pb-0">
            <div className="flex items-center justify-between px-4 py-2.5 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Receipt className="h-3 w-3 text-violet-500" />
                Periodo
              </span>
              <span className="text-right font-medium">
                {formatDate(statement.statement_start)} –{' '}
                {formatDate(statement.statement_end)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Landmark className="h-3 w-3 text-blue-500" />
                {statement.imported_statement_total != null
                  ? 'Total importado'
                  : 'Saldo del corte'}
              </span>
              <span className="font-mono tabular-nums font-medium">
                {formatCurrency(
                  statement.imported_statement_total ??
                    statement.last_statement_balance,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 text-xs">
              <span className="text-muted-foreground">Pagos desde corte</span>
              <span className="font-mono tabular-nums font-medium">
                {formatCurrency(statement.payments_since_last_cutoff)}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 text-xs">
              <span className="text-muted-foreground">Pagos aplicados</span>
              <span className="font-mono tabular-nums font-medium">
                {formatCurrency(statement.payments_applied_to_statement)}
              </span>
            </div>
            <div
              className={cn(
                'flex items-center justify-between px-4 py-3 text-sm font-semibold',
                daysUntilDue < 0
                  ? 'bg-destructive/8 text-destructive'
                  : daysUntilDue <= 5
                    ? 'bg-amber-500/8 text-amber-700 dark:text-amber-300'
                    : 'bg-muted/30',
              )}
            >
              <span>Por pagar</span>
              <span className="font-mono tabular-nums">
                {formatCurrency(statement.next_due_payment)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Compras ciclo actual + MSI vigentes ───────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-border/60">
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

        <Card className="overflow-hidden border-border/60 border-l-[3px] border-l-violet-500/50">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-500/10 dark:bg-violet-500/15">
              <CalendarClock className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            </span>
            <CardTitle className="text-sm font-semibold">
              MSI vigentes
            </CardTitle>
            {statement.msi_active_purchases.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-auto text-[10px] tabular-nums"
              >
                {statement.msi_active_purchases.length}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {statement.msi_active_purchases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay cargos MSI con cuotas pendientes en esta tarjeta.
              </p>
            ) : (
              <PurchaseTableBlock
                items={statement.msi_active_purchases}
                emptyText="Ningún resultado con el filtro aplicado."
                ownerQueryString={ownerQueryString}
                regionLabel="Meses sin intereses vigentes"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Compras del último corte + Historial de pagos ─────────── */}
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

      <CreditCardStatementImportDialog
        open={mpImportDialogOpen}
        onOpenChange={setMpImportDialogOpen}
        creditCardId={creditCardId}
        context={context}
        categoryOptions={categoryOptions}
        statementImports={statementImports}
        onSuccess={loadData}
        onDownloadImport={handleDownloadStatementImport}
        onRollbackClick={(id) => setRollbackImportId(id)}
      />

      <ConfirmDeleteDialog
        open={rollbackImportId !== null}
        onOpenChange={(open) => {
          if (!open) setRollbackImportId(null);
        }}
        onConfirm={handleConfirmRollbackImport}
        title="Revertir importación"
        confirmLabel="Revertir"
        loadingLabel="Revirtiendo…"
        description="Se eliminarán los gastos generados por este PDF, se corregirá la deuda de la tarjeta y se borrará el registro de importación (incluido el archivo guardado, si aplica). Esta acción no se puede deshacer."
        itemName={
          rollbackImportSummary
            ? rollbackImportSummary.period_start &&
              rollbackImportSummary.period_end
              ? `${formatDate(rollbackImportSummary.period_start.slice(0, 10))} – ${formatDate(rollbackImportSummary.period_end.slice(0, 10))}`
              : rollbackImportSummary.file_name ?? `Importación #${rollbackImportSummary.id}`
            : undefined
        }
      />
    </div>
  );
}
