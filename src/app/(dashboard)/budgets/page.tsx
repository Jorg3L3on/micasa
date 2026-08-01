'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useFinanceContext } from '@/context/finance-context';
import BudgetPeriodDetail from '@/components/BudgetPeriodDetail';
import BudgetFormDialog from '@/components/BudgetFormDialog';
import BudgetTemplateFieldsDialog from '@/components/BudgetTemplateFieldsDialog';
import BudgetAllocationsDialog from '@/components/BudgetAllocationsDialog';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  createBudget,
  deleteBudget,
  fetchActivePeriods,
  fetchBudgetHistory,
  fetchBudgetTemplates,
  fetchScheduledPeriods,
  setBudgetActive,
  updateBudgetAllocations,
  updateBudgetTemplate,
  type BudgetAllocationExpenseGroup,
} from '@/lib/api/budgets';
import { formatWallClockDateRange, todayCalendarDate } from '@/lib/calendar-dates';
import { formatCurrency, cn } from '@/lib/utils';
import type { BudgetListItem, BudgetPeriodItem } from '@/types/catalog';
import type { Step1Values, Step2Values } from '@/schemas/budget.schema';
import { BUDGET_FREQUENCY_LABELS, type BudgetFrequency } from '@/schemas/budget.schema';
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Repeat2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type BudgetsView = 'budgets' | 'templates';
type BudgetStatus = 'active' | 'history' | 'scheduled';
type BudgetSort = 'attention' | 'name' | 'period_end';

const PAGE_SIZE = 10;
const DETAIL_REVEAL_CLASS =
  'animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out motion-reduce:animate-none';
const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function useExpenseGroupCache() {
  const cacheRef = useRef(new Map<number, BudgetAllocationExpenseGroup[]>());
  const store = useCallback((periodId: number, groups: BudgetAllocationExpenseGroup[]) => {
    cacheRef.current.set(periodId, groups);
  }, []);
  const read = useCallback((periodId: number) => cacheRef.current.get(periodId), []);
  return { store, read };
}

function parseView(value: string | null): BudgetsView {
  return value === 'templates' ? 'templates' : 'budgets';
}

function parseStatus(value: string | null): BudgetStatus {
  return value === 'history' || value === 'scheduled' ? value : 'active';
}

function parseSort(value: string | null): BudgetSort {
  return value === 'name' || value === 'period_end' ? value : 'attention';
}

function isMonthKey(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value));
}

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function setQueryValue(params: URLSearchParams, key: string, value: string | null) {
  if (!value) params.delete(key);
  else params.set(key, value);
}

function ProgressBar({ spent, total }: { spent: number; total: number }) {
  const percent = total > 0 ? Math.round((spent / total) * 100) : 0;
  const clamped = Math.min(Math.max(percent, 0), 100);
  const toneClass =
    percent >= 100
      ? 'bg-destructive'
      : percent >= 80
        ? 'bg-amber-500 dark:bg-amber-400'
        : 'bg-violet-500 dark:bg-violet-400';
  return (
    <div className="space-y-1.5">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none',
            toneClass,
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-right text-[10px] text-muted-foreground">{percent}% usado</p>
    </div>
  );
}

function BudgetsEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <PiggyBank className="size-5" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function BudgetRow({
  period,
  expanded,
  onToggle,
  onOpenEdit,
  onOpenAllocations,
  onOpenDeactivate,
  context,
  expenseCache,
}: {
  period: BudgetPeriodItem;
  expanded: boolean;
  onToggle: () => void;
  onOpenEdit: (budgetId: number) => void;
  onOpenAllocations: (budgetId: number) => void;
  onOpenDeactivate: (budgetId: number) => void;
  context: ReturnType<typeof useFinanceContext>['context'];
  expenseCache: ReturnType<typeof useExpenseGroupCache>;
}) {
  const percent = period.allocated_amount > 0 ? (period.spent_amount / period.allocated_amount) * 100 : 0;
  const warning = percent >= 80 && percent < 100;
  const over = percent >= 100;
  const remaining = period.allocated_amount - period.spent_amount;
  const remainingTone =
    remaining < 0
      ? 'text-destructive'
      : warning
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-emerald-600 dark:text-emerald-400';

  return (
    <article className="border-b border-border/60 last:border-b-0">
      <div className="px-4 py-3 sm:px-5">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex min-w-0 flex-1 flex-col gap-2 text-left"
            aria-expanded={expanded}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
                <PiggyBank className="h-3 w-3" aria-hidden />
              </span>
              <span className="truncate text-sm font-semibold">{period.name}</span>
              {period.recurrent ? (
                <Repeat2 className="h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden />
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 text-xs">
              <p className="truncate text-muted-foreground">
                {formatWallClockDateRange(period.start_date, period.end_date)}
              </p>
              <p className="shrink-0 font-mono tabular-nums text-muted-foreground">
                {formatCurrency(period.spent_amount)} / {formatCurrency(period.allocated_amount)}
              </p>
            </div>
            <ProgressBar spent={period.spent_amount} total={period.allocated_amount} />
          </button>
          <div className="flex shrink-0 items-start gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  aria-label={`Acciones de ${period.name}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpenEdit(period.budget_id)}>
                  Editar definición
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onOpenAllocations(period.budget_id)}>
                  Editar asignaciones
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onOpenDeactivate(period.budget_id)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Desactivar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={onToggle}
              aria-label={expanded ? 'Ocultar detalle' : 'Ver detalle'}
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200 ease-out motion-reduce:transition-none',
                  expanded && 'rotate-180',
                )}
              />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <Badge variant="outline" className="font-normal">
            {BUDGET_FREQUENCY_LABELS[period.frequency as BudgetFrequency] ?? period.frequency}
          </Badge>
          <p className={cn('text-sm font-mono font-semibold tabular-nums', remainingTone)}>
            {remaining < 0 ? 'Excedido ' : 'Restante '}
            {formatCurrency(Math.abs(remaining))}
          </p>
        </div>
        {warning ? (
          <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            Has usado {Math.round(percent)}% de tu presupuesto.
          </div>
        ) : null}
        {over ? (
          <div className="mt-2 rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Ya excediste este presupuesto.
          </div>
        ) : null}
      </div>
      {expanded ? (
        <div className={cn('border-t border-border/60 bg-muted/20 p-4', DETAIL_REVEAL_CLASS)}>
          <BudgetPeriodDetail
            period={period}
            context={context}
            cachedGroups={expenseCache.read(period.period_id)}
            onGroupsLoaded={expenseCache.store}
          />
        </div>
      ) : null}
    </article>
  );
}

export default function BudgetsPage() {
  const { context } = useFinanceContext();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const expenseCache = useExpenseGroupCache();

  const view = parseView(searchParams.get('view'));
  const status = parseStatus(searchParams.get('status'));
  const q = searchParams.get('q') ?? '';
  const sort = parseSort(searchParams.get('sort'));
  const page = parsePage(searchParams.get('page'));
  const month = isMonthKey(searchParams.get('month')) ? searchParams.get('month')! : todayCalendarDate().slice(0, 7);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periods, setPeriods] = useState<BudgetPeriodItem[]>([]);
  const [templates, setTemplates] = useState<BudgetListItem[]>([]);
  const [expandedPeriodId, setExpandedPeriodId] = useState<number | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [allocDialogOpen, setAllocDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<BudgetListItem | null>(null);
  const [templateSections, setTemplateSections] = useState({ activeOpen: true, inactiveOpen: false });

  const updateQuery = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setView = useCallback((nextView: BudgetsView) => {
    updateQuery((next) => {
      setQueryValue(next, 'view', nextView === 'budgets' ? null : nextView);
      if (nextView !== 'budgets') {
        next.delete('status');
        next.delete('month');
      }
      next.delete('page');
    });
  }, [updateQuery]);

  const setStatus = useCallback((nextStatus: BudgetStatus) => {
    updateQuery((next) => {
      setQueryValue(next, 'status', nextStatus === 'active' ? null : nextStatus);
      if (nextStatus !== 'history') next.delete('month');
      else if (!next.get('month')) next.set('month', todayCalendarDate().slice(0, 7));
      next.delete('page');
    });
  }, [updateQuery]);

  const loadData = useCallback(async () => {
    // Wait for finance context sync (default is user/0 before session + URL resolve).
    // Matching loans/wallets: skip the unscoped fetch that races and paints an empty list.
    if (context.type === 'user' && context.id === 0) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const templatesPromise = fetchBudgetTemplates(context);
      if (view === 'templates') {
        const templatesResult = await templatesPromise;
        setTemplates(templatesResult);
        setPeriods([]);
        return;
      }
      let periodsResult: BudgetPeriodItem[] = [];
      if (status === 'active') {
        periodsResult = await fetchActivePeriods(context);
      } else if (status === 'scheduled') {
        periodsResult = await fetchScheduledPeriods(context);
      } else {
        const year = Number(month.slice(0, 4));
        const monthNumber = Number(month.slice(5, 7));
        const history = await fetchBudgetHistory(year, monthNumber, context);
        periodsResult = history.flatMap((group) =>
          group.periods.map((period) => ({
            ...period,
            budget_id: group.budget_id,
            active: true,
            recurrent: true,
          })),
        );
      }
      const templatesResult = await templatesPromise;
      setTemplates(templatesResult);
      setPeriods(periodsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar presupuestos');
    } finally {
      setLoading(false);
    }
  }, [context, month, status, view]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const templateMap = useMemo(
    () => new Map(templates.map((template) => [template.id, template])),
    [templates],
  );

  const periodRows = useMemo(() => {
    const lowered = q.trim().toLowerCase();
    const filtered = periods.filter((period) => {
      if (!lowered) return true;
      return (
        period.name.toLowerCase().includes(lowered) ||
        (templateMap.get(period.budget_id)?.allocations ?? []).some((allocation) =>
          allocation.category_name.toLowerCase().includes(lowered),
        )
      );
    });

    const urgencyScore = (period: BudgetPeriodItem) => {
      if (period.allocated_amount <= 0) return 0;
      const pct = (period.spent_amount / period.allocated_amount) * 100;
      if (pct >= 100) return 3;
      if (pct >= 80) return 2;
      return 1;
    };

    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'es-MX');
      if (sort === 'period_end') return a.end_date.localeCompare(b.end_date);
      const urgencyDelta = urgencyScore(b) - urgencyScore(a);
      if (urgencyDelta !== 0) return urgencyDelta;
      const pctA = a.allocated_amount > 0 ? a.spent_amount / a.allocated_amount : 0;
      const pctB = b.allocated_amount > 0 ? b.spent_amount / b.allocated_amount : 0;
      if (pctB !== pctA) return pctB - pctA;
      return a.name.localeCompare(b.name, 'es-MX');
    });
  }, [periods, q, sort, templateMap]);

  const totalPages = Math.max(1, Math.ceil(periodRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => periodRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [periodRows, safePage],
  );

  useEffect(() => {
    if (safePage !== page) {
      updateQuery((next) => setQueryValue(next, 'page', safePage <= 1 ? null : String(safePage)));
    }
  }, [page, safePage, updateQuery]);

  const recurringTemplates = useMemo(
    () => templates.filter((template) => template.recurrent),
    [templates],
  );
  const activeTemplates = recurringTemplates.filter((template) => template.active);
  const inactiveTemplates = recurringTemplates.filter((template) => !template.active);

  const openTemplateEdit = useCallback((budgetId: number) => {
    const template = templateMap.get(budgetId);
    if (!template) return;
    setFormError(null);
    setSelectedBudget(template);
    setEditDialogOpen(true);
  }, [templateMap]);

  const openTemplateAllocations = useCallback((budgetId: number) => {
    const template = templateMap.get(budgetId);
    if (!template) return;
    setFormError(null);
    setSelectedBudget(template);
    setAllocDialogOpen(true);
  }, [templateMap]);

  const openTemplateDeactivate = useCallback((budgetId: number) => {
    const template = templateMap.get(budgetId);
    if (!template) return;
    setError(null);
    setSelectedBudget(template);
    setDeleteDialogOpen(true);
  }, [templateMap]);

  const handleCreate = useCallback(async (step1: Step1Values, step2: Step2Values) => {
    try {
      setFormError(null);
      await createBudget(
        {
          name: step1.name,
          allocated_amount: step1.allocated_amount,
          frequency: step1.frequency,
          recurrent: step1.recurrent,
          start_date: step1.start_date ?? null,
          end_date: step1.end_date ?? null,
          allocations: step2.allocations,
        },
        context,
      );
      toast.success('Presupuesto creado');
      await loadData();
      if (view !== 'budgets') setView('budgets');
      if (status !== 'active') setStatus('active');
      setCreateDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo crear el presupuesto';
      setFormError(message);
      throw err;
    }
  }, [context, loadData, setStatus, setView, status, view]);

  const handleDeactivate = useCallback(async () => {
    if (!selectedBudget) return;
    try {
      await deleteBudget(selectedBudget.id, context);
      toast.success(
        selectedBudget.recurrent
          ? 'Plantilla desactivada, se detendrán periodos futuros.'
          : 'Presupuesto cancelado.',
      );
      setDeleteDialogOpen(false);
      setSelectedBudget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo completar la acción');
    }
  }, [context, loadData, selectedBudget]);

  const handleReactivateTemplate = useCallback(async (template: BudgetListItem) => {
    try {
      const suggestedDate = todayCalendarDate();
      const effectiveDate =
        window.prompt(
          'Fecha efectiva de reactivación (YYYY-MM-DD). Se activará en el periodo que contiene esa fecha.',
          suggestedDate,
        )?.trim() ?? '';
      if (!effectiveDate) return;
      await setBudgetActive(template.id, true, effectiveDate, context);
      toast.success('Plantilla reactivada');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reactivar la plantilla');
    }
  }, [context, loadData]);

  const handleUpdateTemplate = useCallback(async (values: Step1Values) => {
    if (!selectedBudget) return;
    try {
      await updateBudgetTemplate(selectedBudget.id, values, context);
      toast.success('Presupuesto actualizado');
      setEditDialogOpen(false);
      setSelectedBudget(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar el presupuesto';
      setFormError(message);
      throw err;
    }
  }, [context, loadData, selectedBudget]);

  const handleUpdateAllocations = useCallback(async (allocations: Step2Values['allocations']) => {
    if (!selectedBudget) return;
    try {
      await updateBudgetAllocations(selectedBudget.id, allocations, context);
      toast.success('Asignaciones actualizadas');
      setAllocDialogOpen(false);
      setSelectedBudget(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudieron actualizar las asignaciones';
      setFormError(message);
      throw err;
    }
  }, [context, loadData, selectedBudget]);

  const currentYear = Number(todayCalendarDate().slice(0, 4));
  const currentMonth = Number(todayCalendarDate().slice(5, 7));
  const selectedYear = Number(month.slice(0, 4));
  const selectedMonth = Number(month.slice(5, 7));
  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;

  const moveMonth = useCallback((direction: -1 | 1) => {
    const date = new Date(Date.UTC(selectedYear, selectedMonth - 1 + direction, 1));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    updateQuery((next) => {
      next.set('month', `${y}-${m}`);
      next.delete('page');
    });
  }, [selectedMonth, selectedYear, updateQuery]);

  return (
    <div className="space-y-5">
      <header className="sticky top-16 z-20 border-b border-border/60 bg-background group-has-data-[collapsible=icon]/sidebar-wrapper:top-12">
        <div className="flex min-h-14 items-center justify-between gap-4 py-2">
          <div>
            <h2 className="text-lg font-semibold leading-tight">Presupuestos</h2>
            <p className="text-xs text-muted-foreground">
              Controla tus gastos con presupuestos flexibles.
            </p>
          </div>
          <Button
            variant="outline"
            className="h-9 shrink-0 bg-white dark:bg-card"
            onClick={() => setCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo presupuesto</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-5" role="tablist" aria-label="Vista de presupuestos">
            {([
              ['budgets', 'Presupuestos'],
              ['templates', 'Plantillas'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={view === value}
                onClick={() => setView(value)}
                className={cn(
                  'relative h-10 px-0.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  view === value &&
                    'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {view === 'budgets' ? (
            <div className="mb-1 flex items-center gap-2">
              <div
                className="flex items-center rounded-lg bg-muted p-1"
                role="tablist"
                aria-label="Estado de presupuestos"
              >
                {([
                  ['active', 'Activos'],
                  ['history', 'Historial'],
                  ['scheduled', 'Programados'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={status === value}
                    onClick={() => setStatus(value)}
                    className={cn(
                      'h-7 rounded-md px-3 text-xs font-medium text-muted-foreground transition-[color,background-color,box-shadow] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      status === value && 'bg-background text-foreground shadow-sm',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {view === 'budgets' && status === 'history' ? (
          <div className="flex justify-end pb-2">
            <div className="flex items-center rounded-lg border border-border/60 bg-card px-1 py-0.5">
              <Button variant="ghost" size="icon" className="size-8" onClick={() => moveMonth(-1)} aria-label="Mes anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="min-w-28 text-center text-sm">
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </p>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => moveMonth(1)} disabled={isCurrentMonth} aria-label="Mes siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <div>
            <AlertTitle>No se pudo completar la carga</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </div>
        </Alert>
      ) : null}

      {view === 'budgets' ? (
        <Card className="gap-0 py-0">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-4 sm:p-5">
              <div className="relative min-w-56 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(event) =>
                    updateQuery((next) => {
                      setQueryValue(next, 'q', event.target.value || null);
                      next.delete('page');
                    })
                  }
                  className="h-9 pl-9"
                  placeholder="Buscar presupuesto o categoría..."
                  aria-label="Buscar presupuestos"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-9">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Orden
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => updateQuery((next) => setQueryValue(next, 'sort', null))}>
                    Urgencia
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateQuery((next) => next.set('sort', 'name'))}>
                    Nombre
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updateQuery((next) => next.set('sort', 'period_end'))}>
                    Cierre de periodo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {loading ? (
              <div className="space-y-2 p-4 sm:p-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full rounded-lg" />
                ))}
              </div>
            ) : pagedRows.length === 0 ? (
              <BudgetsEmpty
                title="No hay presupuestos para este filtro"
                description="Cambia el estado, ajusta búsqueda o crea un presupuesto."
              />
            ) : (
              <div>
                {pagedRows.map((period) => (
                  <BudgetRow
                    key={period.period_id}
                    period={period}
                    expanded={expandedPeriodId === period.period_id}
                    onToggle={() =>
                      setExpandedPeriodId((current) => (current === period.period_id ? null : period.period_id))
                    }
                    onOpenEdit={openTemplateEdit}
                    onOpenAllocations={openTemplateAllocations}
                    onOpenDeactivate={openTemplateDeactivate}
                    context={context}
                    expenseCache={expenseCache}
                  />
                ))}
                <div className="flex items-center justify-between p-4 text-sm text-muted-foreground sm:p-5">
                  <p>
                    Página {safePage} de {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={safePage <= 1}
                      onClick={() =>
                        updateQuery((next) => setQueryValue(next, 'page', safePage - 1 <= 1 ? null : String(safePage - 1)))
                      }
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={safePage >= totalPages}
                      onClick={() =>
                        updateQuery((next) => setQueryValue(next, 'page', String(safePage + 1)))
                      }
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0">
          <CardContent className="space-y-5 p-4 sm:p-5">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : recurringTemplates.length === 0 ? (
              <BudgetsEmpty
                title="No hay plantillas recurrentes"
                description="Crea un presupuesto recurrente para administrarlo aquí."
              />
            ) : (
              <>
                <section className="space-y-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left"
                    onClick={() =>
                      setTemplateSections((current) => ({ ...current, activeOpen: !current.activeOpen }))
                    }
                  >
                    <span className="text-sm font-semibold">Plantillas activas ({activeTemplates.length})</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', templateSections.activeOpen && 'rotate-180')} />
                  </button>
                  {templateSections.activeOpen ? (
                    <div className="divide-y divide-border/60 rounded-lg border border-border/60">
                      {activeTemplates.map((template) => (
                        <div key={template.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{template.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {BUDGET_FREQUENCY_LABELS[template.frequency as BudgetFrequency] ?? template.frequency}
                            </p>
                          </div>
                          <p className="font-mono text-sm font-semibold tabular-nums">
                            {formatCurrency(template.allocated_amount)}
                          </p>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-9">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openTemplateEdit(template.id)}>
                                Editar definición
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openTemplateAllocations(template.id)}>
                                Editar asignaciones
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => openTemplateDeactivate(template.id)}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Desactivar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="space-y-2">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-left"
                    onClick={() =>
                      setTemplateSections((current) => ({ ...current, inactiveOpen: !current.inactiveOpen }))
                    }
                  >
                    <span className="text-sm font-semibold">Plantillas inactivas ({inactiveTemplates.length})</span>
                    <ChevronDown className={cn('h-4 w-4 transition-transform', templateSections.inactiveOpen && 'rotate-180')} />
                  </button>
                  {templateSections.inactiveOpen ? (
                    <div className="divide-y divide-border/60 rounded-lg border border-border/60">
                      {inactiveTemplates.length === 0 ? (
                        <p className="px-4 py-6 text-sm text-muted-foreground">No hay plantillas inactivas.</p>
                      ) : (
                        inactiveTemplates.map((template) => (
                          <div key={template.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-muted-foreground">{template.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {BUDGET_FREQUENCY_LABELS[template.frequency as BudgetFrequency] ?? template.frequency}
                              </p>
                            </div>
                            <p className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                              {formatCurrency(template.allocated_amount)}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => handleReactivateTemplate(template)}
                            >
                              <RotateCcw className="mr-2 h-3.5 w-3.5" />
                              Reactivar
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  ) : null}
                </section>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <BudgetFormDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setFormError(null);
        }}
        onCreate={handleCreate}
        error={formError && createDialogOpen ? formError : null}
      />

      {selectedBudget ? (
        <>
          <BudgetTemplateFieldsDialog
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) {
                setSelectedBudget(null);
                setFormError(null);
              }
            }}
            budget={selectedBudget}
            onSave={handleUpdateTemplate}
            error={formError && editDialogOpen ? formError : null}
          />

          <BudgetAllocationsDialog
            open={allocDialogOpen}
            onOpenChange={(open) => {
              setAllocDialogOpen(open);
              if (!open) {
                setSelectedBudget(null);
                setFormError(null);
              }
            }}
            budget={selectedBudget}
            onSave={handleUpdateAllocations}
            error={formError && allocDialogOpen ? formError : null}
          />

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) setSelectedBudget(null);
            }}
            onConfirm={handleDeactivate}
            title={selectedBudget.recurrent ? 'Desactivar plantilla' : 'Cancelar presupuesto'}
            description={
              selectedBudget.recurrent
                ? 'Conservarás el historial y se detendrán periodos futuros.'
                : 'El presupuesto dejará de aparecer en activos y quedará en el historial.'
            }
            itemName={selectedBudget.name}
          />
        </>
      ) : null}
    </div>
  );
}
