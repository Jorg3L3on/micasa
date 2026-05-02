'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  ChevronDown,
  Coins,
  ChevronLeft,
  ChevronRight,
  Download,
  Landmark,
  Pencil,
  Plus,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import WalletImportDialog from '@/components/wallets/WalletImportDialog';
import WalletBalanceDialog from '@/components/wallets/WalletBalanceDialog';
import WalletQuickIncomeDialog from '@/components/wallets/WalletQuickIncomeDialog';
import ExpenseFormSheet from '@/components/expenses/ExpenseFormSheet';
import type { AddExpenseFormValues } from '@/schemas/transaction.schema';
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
import { buildOwnerQuery, clientFetchFromApi } from '@/lib/api/client-fetch';
import { downloadWalletMovementsCsv } from '@/lib/finance/wallet-movements-csv';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type {
  WalletDetail,
  WalletMovement,
  WalletMovementsResponse,
} from '@/types/wallet-movements';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

const firstDayOfMonth = (year: number, monthIdx: number): string =>
  `${year}-${String(monthIdx + 1).padStart(2, '0')}-01`;

const lastDayOfMonth = (year: number, monthIdx: number): string => {
  const last = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
};

const MONTH_LABEL: Record<number, string> = {
  0: 'Enero',
  1: 'Febrero',
  2: 'Marzo',
  3: 'Abril',
  4: 'Mayo',
  5: 'Junio',
  6: 'Julio',
  7: 'Agosto',
  8: 'Septiembre',
  9: 'Octubre',
  10: 'Noviembre',
  11: 'Diciembre',
};

const parseYearMonth = (fromDate: string): { year: number; monthIdx: number } => {
  const [y, m] = fromDate.split('-').map(Number);
  return { year: y, monthIdx: m - 1 };
};

type SortDir = 'asc' | 'desc';
type SortField = 'date' | 'amount' | 'description' | 'category';

const sortMovements = (
  items: WalletMovement[],
  field: SortField,
  dir: SortDir,
  query: string,
  kindFilter: 'all' | 'income' | 'expense',
): WalletMovement[] => {
  const q = query.trim().toLowerCase();
  let rows = kindFilter === 'all' ? [...items] : items.filter((i) => i.kind === kindFilter);
  if (q) {
    rows = rows.filter(
      (i) =>
        i.description.toLowerCase().includes(q) ||
        (i.category?.toLowerCase().includes(q) ?? false),
    );
  }
  const m = dir === 'desc' ? -1 : 1;
  rows.sort((a, b) => {
    if (field === 'amount') return m * (a.amount - b.amount);
    if (field === 'description') {
      return m * a.description.localeCompare(b.description, 'es');
    }
    if (field === 'category') {
      return m * (a.category ?? '').localeCompare(b.category ?? '', 'es');
    }
    if (a.date !== b.date) return m * a.date.localeCompare(b.date);
    return m * (a.id - b.id);
  });
  return rows;
};

const SortButton = ({
  sortKey,
  label,
  activeKey,
  dir,
  onSort,
}: {
  sortKey: SortField;
  label: string;
  activeKey: SortField;
  dir: SortDir;
  onSort: (k: SortField) => void;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className="h-7 px-1.5 text-[10px] font-semibold uppercase tracking-wider"
    onClick={() => onSort(sortKey)}
    aria-label={`Ordenar por ${label}`}
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

const WalletDetailSkeleton = () => (
  <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <Skeleton className="h-9 w-24" />
    </div>
    <Skeleton className="mx-auto h-10 w-64 max-w-full" />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
    <Skeleton className="h-64 rounded-xl" />
  </div>
);

export default function WalletDetailPage() {
  const params = useParams<{ id: string }>();
  const { context } = useFinanceContext();
  const walletId = Number(params.id);

  const [wallet, setWallet] = useState<WalletDetail | null>(null);
  const [data, setData] = useState<WalletMovementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: string; to: string }>(() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    return { from: firstDayOfMonth(y, m), to: lastDayOfMonth(y, m) };
  });
  const [importOpen, setImportOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [field, setField] = useState<SortField>('date');
  const [dir, setDir] = useState<SortDir>('desc');

  const ownerQueryString = useMemo(() => {
    const q = buildOwnerQuery(context);
    const s = q.toString();
    return s ? `?${s}` : '';
  }, [context]);

  const canImport = wallet?.type === 'CASH' || wallet?.type === 'DEBIT_CARD';

  const loadData = useCallback(async () => {
    if (context.id === 0) return;
    if (!Number.isFinite(walletId)) {
      setError('Billetera inválida');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [detail, movements] = await Promise.all([
        clientFetchFromApi<WalletDetail>(
          `/api/wallets/${walletId}`,
          undefined,
          context,
        ),
        clientFetchFromApi<WalletMovementsResponse>(
          `/api/wallets/${walletId}/movements?from=${range.from}&to=${range.to}`,
          undefined,
          context,
        ),
      ]);
      setWallet(detail);
      setData(movements);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar la billetera',
      );
    } finally {
      setLoading(false);
    }
  }, [context, walletId, range.from, range.to]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrevMonth = useCallback(() => {
    const { year, monthIdx } = parseYearMonth(range.from);
    const prev = new Date(Date.UTC(year, monthIdx - 1, 1));
    const py = prev.getUTCFullYear();
    const pm = prev.getUTCMonth();
    setRange({ from: firstDayOfMonth(py, pm), to: lastDayOfMonth(py, pm) });
  }, [range.from]);

  const handleNextMonth = useCallback(() => {
    const { year, monthIdx } = parseYearMonth(range.from);
    const next = new Date(Date.UTC(year, monthIdx + 1, 1));
    const ny = next.getUTCFullYear();
    const nm = next.getUTCMonth();
    setRange({ from: firstDayOfMonth(ny, nm), to: lastDayOfMonth(ny, nm) });
  }, [range.from]);

  const handleResetToToday = useCallback(() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    setRange({ from: firstDayOfMonth(y, m), to: lastDayOfMonth(y, m) });
  }, []);

  const isCurrentMonth = useMemo(() => {
    const today = getTodayDateString();
    return today >= range.from && today <= range.to;
  }, [range.from, range.to]);

  const handleCreateExpense = useCallback(
    async (values: AddExpenseFormValues) => {
      setExpenseError(null);
      try {
        await clientFetchFromApi(
          '/api/expenses',
          {
            method: 'POST',
            body: JSON.stringify(values),
          },
          context,
        );
        toast.success('Gasto registrado');
        setExpenseOpen(false);
        await loadData();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'No se pudo crear el gasto';
        setExpenseError(message);
        throw err;
      }
    },
    [context, loadData],
  );

  const handleExportCsv = useCallback(() => {
    if (!wallet || !data) return;
    try {
      downloadWalletMovementsCsv(wallet, range, data.movements);
      toast.success('CSV descargado');
    } catch {
      toast.error('No se pudo exportar el CSV');
    }
  }, [wallet, data, range]);

  const sortedMovements = useMemo(() => {
    if (!data) return [];
    return sortMovements(data.movements, field, dir, query, kindFilter);
  }, [data, field, dir, query, kindFilter]);

  const handleSortClick = (next: SortField) => {
    if (field === next) {
      setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setField(next);
    setDir(next === 'date' || next === 'amount' ? 'desc' : 'asc');
  };

  const rangeLabel = useMemo(() => {
    const { year, monthIdx } = parseYearMonth(range.from);
    return `${MONTH_LABEL[monthIdx]} ${year}`;
  }, [range.from]);

  const Icon = wallet?.type === 'DEBIT_CARD' ? Landmark : Banknote;
  const iconColorBg =
    wallet?.type === 'DEBIT_CARD'
      ? 'bg-blue-500/10 dark:bg-blue-500/15'
      : 'bg-emerald-500/10 dark:bg-emerald-500/15';
  const iconColorFg =
    wallet?.type === 'DEBIT_CARD'
      ? 'text-blue-600 dark:text-blue-400'
      : 'text-emerald-600 dark:text-emerald-400';

  if (context.id === 0 || (loading && !data)) {
    return <WalletDetailSkeleton />;
  }

  if (error || !wallet || !data) {
    return (
      <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
        {error ?? 'No se pudo cargar la billetera'}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              iconColorBg,
            )}
          >
            <Icon className={cn('h-4 w-4', iconColorFg)} />
          </span>
          <div>
            <h1 className="text-xl font-semibold">{wallet.name}</h1>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>
                {wallet.type === 'DEBIT_CARD' ? 'Tarjeta de débito' : 'Efectivo'} ·{' '}
                Saldo {formatCurrency(wallet.amount)}
              </span>
              {canImport && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setBalanceOpen(true)}
                  aria-label="Ajustar saldo"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {canImport && (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-9 gap-1.5"
                onClick={() => {
                  setExpenseError(null);
                  setExpenseOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Registrar gasto
              </Button>
              <Button
                type="button"
                className="h-9 gap-1.5 rounded-xl"
                onClick={() => setIncomeOpen(true)}
              >
                <Coins className="h-4 w-4" />
                Registrar ingreso
              </Button>
            </>
          )}
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
            {canImport && (
              <DropdownMenuItem
                onClick={() => setBalanceOpen(true)}
                className="cursor-pointer"
              >
                <Pencil className="mr-2 h-4 w-4 shrink-0" />
                Ajustar saldo
              </DropdownMenuItem>
            )}
            {canImport && (
              <DropdownMenuItem
                onClick={() => setImportOpen(true)}
                className="cursor-pointer"
              >
                <Upload className="mr-2 h-4 w-4 shrink-0" />
                Importar CSV
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={handleExportCsv}
              className="cursor-pointer"
            >
              <Download className="mr-2 h-4 w-4 shrink-0" />
              Exportar CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* Range nav + KPIs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 self-start rounded-lg border border-border/60 bg-muted/40 px-1 py-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrevMonth}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="min-w-0 px-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Periodo
            </p>
            <p className="text-xs font-semibold tabular-nums">{rangeLabel}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextMonth}
            disabled={isCurrentMonth}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          {!isCurrentMonth && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-1.5 text-[10px]"
              onClick={handleResetToToday}
              aria-label="Volver al mes actual"
            >
              <RotateCcw className="h-3 w-3" />
              Hoy
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="rounded-lg border border-l-[3px] border-l-emerald-500/50 bg-emerald-500/5 px-3 py-2 dark:bg-emerald-500/8">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ingresos
            </p>
            <p className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(data.totals.inflow)}
            </p>
          </div>
          <div className="rounded-lg border border-l-[3px] border-l-rose-500/50 bg-rose-500/5 px-3 py-2 dark:bg-rose-500/8">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Egresos
            </p>
            <p className="text-sm font-bold font-mono tabular-nums">
              {formatCurrency(data.totals.outflow)}
            </p>
          </div>
          <div className="rounded-lg border border-l-[3px] border-l-blue-500/50 bg-blue-500/5 px-3 py-2 dark:bg-blue-500/8">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              Neto
            </p>
            <p
              className={cn(
                'text-sm font-bold font-mono tabular-nums',
                data.totals.net < 0 && 'text-destructive',
              )}
            >
              {formatCurrency(data.totals.net)}
            </p>
          </div>
        </div>
      </div>

      {/* Movements list */}
      <Card className="overflow-hidden border-border/60">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por descripción o categoría…"
                className="max-w-sm text-sm"
                aria-label="Filtrar movimientos"
              />
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant={kindFilter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-[10px] font-semibold uppercase"
                  onClick={() => setKindFilter('all')}
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant={kindFilter === 'income' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-[10px] font-semibold uppercase"
                  onClick={() => setKindFilter('income')}
                >
                  Ingresos
                </Button>
                <Button
                  type="button"
                  variant={kindFilter === 'expense' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2 text-[10px] font-semibold uppercase"
                  onClick={() => setKindFilter('expense')}
                >
                  Egresos
                </Button>
              </div>
            </div>
            <div
              className="flex flex-wrap gap-0.5"
              role="group"
              aria-label="Ordenar movimientos"
            >
              <SortButton sortKey="date" label="Fecha" activeKey={field} dir={dir} onSort={handleSortClick} />
              <SortButton sortKey="amount" label="Monto" activeKey={field} dir={dir} onSort={handleSortClick} />
              <SortButton sortKey="description" label="Concepto" activeKey={field} dir={dir} onSort={handleSortClick} />
              <SortButton sortKey="category" label="Categoría" activeKey={field} dir={dir} onSort={handleSortClick} />
            </div>
            {data.movements.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay movimientos en este período.
              </p>
            ) : sortedMovements.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Ningún movimiento coincide con el filtro.
              </p>
            ) : (
              <ul className="space-y-2">
                {sortedMovements.map((m) => {
                  const isIn = m.direction === 'in';
                  const fortnightLink =
                    m.fortnightYear != null && m.fortnightMonth != null && m.fortnightPeriod
                      ? `/fortnight/${m.fortnightYear}/${String(m.fortnightMonth).padStart(2, '0')}/${m.fortnightPeriod}${ownerQueryString}`
                      : null;
                  return (
                    <li
                      key={`${m.kind}-${m.id}`}
                      className="rounded-md border border-border/60 px-3 py-2"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-medium">
                            {m.description}
                            <Badge
                              variant="outline"
                              className={cn(
                                'ml-1.5 align-middle text-[9px] font-semibold uppercase tracking-wider',
                                isIn
                                  ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                                  : 'border-rose-500/40 text-rose-600 dark:text-rose-400',
                              )}
                            >
                              {isIn ? 'Ingreso' : 'Egreso'}
                            </Badge>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {m.category ? `${m.category} · ` : ''}
                            {formatDate(m.date)}
                          </p>
                          {fortnightLink && (
                            <Link
                              href={fortnightLink}
                              className="text-[10px] font-medium text-primary underline-offset-2 hover:underline"
                            >
                              Ver en quincena
                            </Link>
                          )}
                        </div>
                        <span
                          className={cn(
                            'shrink-0 font-mono text-sm font-bold tabular-nums',
                            isIn && 'text-emerald-600 dark:text-emerald-400',
                          )}
                        >
                          {isIn ? '+' : '−'} {formatCurrency(m.amount)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {canImport && (
        <WalletImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          walletId={walletId}
          context={context}
          onSuccess={loadData}
        />
      )}

      {canImport && (
        <ExpenseFormSheet
          open={expenseOpen}
          onOpenChange={(open) => {
            setExpenseOpen(open);
            if (!open) setExpenseError(null);
          }}
          mode="create"
          title={`Registrar gasto — ${wallet.name}`}
          description="Registra un gasto pagado con esta billetera; asignamos la quincena automáticamente."
          defaults={{ paymentMethodId: walletId, isPaid: true }}
          onSubmit={handleCreateExpense}
          error={expenseError}
        />
      )}

      {canImport && (
        <WalletQuickIncomeDialog
          open={incomeOpen}
          onOpenChange={setIncomeOpen}
          walletId={walletId}
          walletName={wallet.name}
          context={context}
          onSuccess={loadData}
        />
      )}

      {canImport && (
        <WalletBalanceDialog
          open={balanceOpen}
          onOpenChange={setBalanceOpen}
          walletId={walletId}
          walletName={wallet.name}
          currentAmount={wallet.amount}
          context={context}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
