'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCheck, ChevronDown, Plus, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import EmptyState from '@/components/EmptyState';
import { ErrorBanner } from '@/components/error-banner';
import { FilterChip } from '@/components/filter-chip';
import { Money } from '@/components/money';
import { SegmentedControl } from '@/components/segmented-control';
import { Button } from '@/components/ui/button';
import { useFinanceContext } from '@/context/finance-context';
import { useRegisterToolbarActions } from '@/context/toolbar-actions-context';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ClientApiError } from '@/lib/api/client-fetch';
import {
  deleteExpenseTemplate,
  setExpenseTemplateActive,
} from '@/lib/api/expense-templates';
import { deleteIncomeTemplate, setIncomeTemplateActive } from '@/lib/api/incomes';
import {
  sectionize,
  summarize,
  type ScheduledKind,
  type ScheduledView,
} from '@/lib/ui/scheduled-items';
import { cn } from '@/lib/utils';
import { ScheduledFormOverlay, type ScheduledOverlayState } from './ScheduledFormOverlay';
import { ScheduledRow, SCHEDULED_GRID_CLASS } from './ScheduledRow';
import { ScheduledSummary } from './ScheduledSummary';
import {
  chipCounts,
  filterRows,
  KIND_COPY,
  programadosCount,
  subscriptionsCount,
  type ScheduledRowModel,
} from './scheduled-rows';

type ScheduledListProps = {
  kind: ScheduledKind;
  rows: ScheduledRowModel[];
  /** The page's `PAGE_CREATE_ACTION` label (header "+"). */
  createLabel: string;
  /** The server page could not load the list. */
  loadFailed?: boolean;
};

const VIEW_OPTIONS = [
  { value: 'all', label: 'Todas' },
  { value: 'first', label: '1ª quincena' },
  { value: 'second', label: '2ª quincena' },
] as const;

/** What the one overlay shows: the detail of an item, or the form (new or edit). */
type OverlayTarget =
  | { mode: 'detail'; id: number }
  | { mode: 'form'; id: number | null; fromDetail: boolean };

const SECTION_BAR_CLASS =
  'flex items-center gap-2 border-t border-border/60 bg-muted/30 px-5 text-xs font-semibold text-muted-foreground';

const deleteMessage = (kind: ScheduledKind, err: unknown): string => {
  const apiErr = err as ClientApiError;
  const message =
    err instanceof Error && err.message
      ? err.message
      : `No se pudo eliminar el ${KIND_COPY[kind].singular}.`;
  if (apiErr?.status === 409 || /en uso|in use|conflict|409/i.test(message)) {
    return `No se pudo eliminar: este ${KIND_COPY[kind].singular} está en uso. Puedes desactivarlo.`;
  }
  return message;
};

/** Summary, view control, chips and the row list of one programados screen. */
export const ScheduledList = ({ kind, rows, createLabel, loadFailed = false }: ScheduledListProps) => {
  const copy = KIND_COPY[kind];
  const router = useRouter();
  const { context } = useFinanceContext();
  const isMobile = useIsMobile();

  const [view, setView] = useState<ScheduledView>('all');
  const [query, setQuery] = useState('');
  const [subscriptionsOnly, setSubscriptionsOnly] = useState(false);
  const [variableOnly, setVariableOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [removedIds, setRemovedIds] = useState<ReadonlySet<number>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<ScheduledRowModel | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  /** The detail or form overlay; null when closed. */
  const [overlay, setOverlay] = useState<OverlayTarget | null>(null);
  /** Set after a save until the refreshed list arrives. */
  const [afterSave, setAfterSave] = useState<{ id: number | null; editing: boolean } | null>(
    null,
  );
  const [refreshing, startRefresh] = useTransition();
  /** Optimistic Activo values, by id, until the server list catches up. */
  const [activeOverrides, setActiveOverrides] = useState<ReadonlyMap<number, boolean>>(
    new Map(),
  );
  const [savingActive, setSavingActive] = useState(false);

  // The header "+" and the empty state open the form in the overlay.
  const handleCreate = useCallback(() => {
    setOverlay({ mode: 'form', id: null, fromDetail: false });
  }, []);

  // A row opens the read-first detail overlay.
  const handleOpen = useCallback((row: ScheduledRowModel) => {
    setOverlay({ mode: 'detail', id: row.item.id });
  }, []);

  // Editar swaps the same overlay to the form (no stacked sheets).
  const handleEdit = useCallback((row: ScheduledRowModel) => {
    setOverlay({ mode: 'form', id: row.item.id, fromDetail: true });
  }, []);

  // Cancelar on a form opened from the detail goes back to the detail.
  const handleDismiss = useCallback(() => {
    setOverlay((current) =>
      current?.mode === 'form' && current.fromDetail && current.id !== null
        ? { mode: 'detail', id: current.id }
        : null,
    );
  }, []);

  const handleSaved = (id: number | null, editing: boolean) => {
    toast.success(
      editing
        ? `${copy.singular.charAt(0).toUpperCase()}${copy.singular.slice(1)} actualizado`
        : `${copy.singular.charAt(0).toUpperCase()}${copy.singular.slice(1)} agregado`,
    );
    if (id !== null) {
      setActiveOverrides((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
    setAfterSave({ id, editing });
    startRefresh(() => router.refresh());
  };

  // Once the refreshed list is in, an edit shows the detail with the new values.
  useEffect(() => {
    if (!afterSave || refreshing) return;
    setOverlay(
      afterSave.editing && afterSave.id !== null ? { mode: 'detail', id: afterSave.id } : null,
    );
    setAfterSave(null);
  }, [afterSave, refreshing]);

  const setOverride = (id: number, active: boolean) =>
    setActiveOverrides((prev) => new Map(prev).set(id, active));

  const handleActiveChange = async (row: ScheduledRowModel, next: boolean) => {
    const id = row.item.id;
    const previous = row.item.active;
    setOverride(id, next);
    setSavingActive(true);
    try {
      if (kind === 'expense') {
        await setExpenseTemplateActive(id, next, context);
      } else {
        await setIncomeTemplateActive(id, next, context);
      }
      router.refresh();
    } catch {
      setOverride(id, previous);
      toast.error(
        `No se pudo ${next ? 'activar' : 'desactivar'} el ${copy.singular}. Inténtalo de nuevo.`,
      );
    } finally {
      setSavingActive(false);
    }
  };

  const primaryActionIcon = useMemo(() => <Plus data-icon="inline-start" />, []);

  useRegisterToolbarActions({
    search: {
      value: query,
      onChange: setQuery,
      placeholder: `Buscar ${copy.singular}`,
    },
    primaryAction: {
      label: createLabel,
      onClick: handleCreate,
      icon: primaryActionIcon,
    },
  });

  const liveRows = useMemo(
    () =>
      rows
        .filter((row) => !removedIds.has(row.item.id))
        .map((row) => {
          const active = activeOverrides.get(row.item.id);
          return active === undefined || active === row.item.active
            ? row
            : { ...row, item: { ...row.item, active } };
        }),
    [rows, removedIds, activeOverrides],
  );
  const overlayState = useMemo((): ScheduledOverlayState | null => {
    if (!overlay) return null;
    const row =
      overlay.id === null ? null : liveRows.find((r) => r.item.id === overlay.id) ?? null;
    if (overlay.mode === 'detail') return row ? { mode: 'detail', row } : null;
    if (overlay.id !== null && !row) return null;
    return { mode: 'form', row, fromDetail: overlay.fromDetail };
  }, [overlay, liveRows]);
  const summary = useMemo(() => summarize(liveRows.map((r) => r.item)), [liveRows]);
  const counts = useMemo(() => chipCounts(liveRows), [liveRows]);

  const filtered = useMemo(
    () => filterRows(liveRows, { query, subscriptionsOnly, variableOnly }),
    [liveRows, query, subscriptionsOnly, variableOnly],
  );
  const rowById = useMemo(
    () => new Map(filtered.map((row) => [row.item.id, row])),
    [filtered],
  );
  const sections = useMemo(() => {
    const raw = sectionize(
      filtered.map((row) => row.item),
      view,
    );
    const pick = (items: typeof raw.programados) =>
      items.map((item) => rowById.get(item.id)).filter(Boolean) as ScheduledRowModel[];
    return {
      programados: pick(raw.programados),
      sinProgramar: pick(raw.sinProgramar),
      inactivos: pick(raw.inactivos),
    };
  }, [filtered, rowById, view]);
  const viewTotal = useMemo(
    () => (view === 'all' ? null : summarize(sections.programados.map((r) => r.item))),
    [sections.programados, view],
  );

  const filtersActive = query.trim() !== '' || subscriptionsOnly || variableOnly;
  const clearFilters = () => {
    setQuery('');
    setSubscriptionsOnly(false);
    setVariableOnly(false);
  };

  const handleRetry = () => {
    setRetrying(true);
    router.refresh();
    // refresh has no promise; the server re-render replaces this banner.
    window.setTimeout(() => setRetrying(false), 1500);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    try {
      setDeleteError(null);
      if (kind === 'expense') {
        await deleteExpenseTemplate(target.item.id, context);
      } else {
        await deleteIncomeTemplate(target.item.id, context);
      }
      setRemovedIds((prev) => new Set(prev).add(target.item.id));
      setPendingDelete(null);
      if (overlay?.id === target.item.id) setOverlay(null);
      toast.success(
        kind === 'expense' ? 'Gasto programado eliminado' : 'Ingreso programado eliminado',
      );
      router.refresh();
    } catch (err) {
      const message = deleteMessage(kind, err);
      setDeleteError(message);
      toast.error(message);
    }
  };

  const overlayElement = (
    <ScheduledFormOverlay
      kind={kind}
      state={overlayState}
      onDismiss={handleDismiss}
      onActiveChange={handleActiveChange}
      savingActive={savingActive}
      onEdit={handleEdit}
      onRequestDelete={(target) => {
        setDeleteError(null);
        setPendingDelete(target);
      }}
      onSaved={handleSaved}
      refreshing={refreshing}
    />
  );

  if (loadFailed) {
    return (
      <ErrorBanner>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            No pudimos cargar tus {copy.plural}. Revisa tu conexión e inténtalo de nuevo.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? 'Reintentando…' : 'Reintentar'}
          </Button>
        </div>
      </ErrorBanner>
    );
  }

  if (liveRows.length === 0) {
    return (
      <>
      <div className="rounded-xl border border-border/60 bg-card">
        <EmptyState
          icon={CalendarCheck}
          message={`Aún no tienes ${copy.plural}`}
          description={
            kind === 'expense'
              ? 'Agrega los que se repiten cada quincena, como renta, luz o suscripciones. MiCasa los crea al abrir el mes.'
              : 'Agrega lo que recibes cada quincena, como tu sueldo o una renta. MiCasa los crea al abrir el mes.'
          }
          action={{ label: copy.createLabel, onClick: handleCreate }}
        />
      </div>
      {overlayElement}
      </>
    );
  }

  const nothingMatches =
    sections.programados.length === 0 &&
    sections.sinProgramar.length === 0 &&
    sections.inactivos.length === 0;

  const renderRows = (list: ScheduledRowModel[]) => (
    <ul>
      {list.map((row) => (
        <ScheduledRow
          key={row.item.id}
          row={row}
          view={view}
          swipeEnabled={isMobile}
          onOpen={handleOpen}
          onRequestDelete={(target) => {
            setDeleteError(null);
            setPendingDelete(target);
          }}
        />
      ))}
    </ul>
  );

  const periodLabel = view === 'first' ? '1ª quincena' : '2ª quincena';
  const viewPeriod = viewTotal ? (view === 'first' ? viewTotal.first : viewTotal.second) : null;

  return (
    <>
      <div className="flex min-w-0 flex-col gap-4 md:gap-5">
        <ScheduledSummary
          kind={kind}
          summary={summary}
          programados={programadosCount(liveRows)}
          subscriptions={subscriptionsCount(liveRows)}
        />

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <SegmentedControl
            value={view}
            onValueChange={(next) => setView(next as ScheduledView)}
            options={VIEW_OPTIONS}
            ariaLabel="Ver por quincena"
            className="w-full md:w-auto"
            stretch={isMobile}
            listClassName="w-full md:w-max"
          />
          {kind === 'expense' ? (
            <div className="flex flex-wrap gap-2">
              <FilterChip
                selected={subscriptionsOnly}
                count={counts.subscriptions}
                onClick={() => setSubscriptionsOnly((v) => !v)}
              >
                Suscripciones
              </FilterChip>
              <FilterChip
                selected={variableOnly}
                count={counts.variable}
                onClick={() => setVariableOnly((v) => !v)}
              >
                Con monto variable
              </FilterChip>
            </div>
          ) : null}
        </div>

        <section
          aria-label={
            view === 'all'
              ? copy.plural.charAt(0).toUpperCase() + copy.plural.slice(1)
              : `${copy.countNoun.charAt(0).toUpperCase() + copy.countNoun.slice(1)} de la ${periodLabel}`
          }
          data-testid="scheduled-list"
          className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card"
        >
          {nothingMatches ? (
            <EmptyState
              icon={SearchX}
              message={
                filtersActive
                  ? `Ningún ${copy.singular} coincide`
                  : `No hay ${copy.plural} en la ${periodLabel}`
              }
              action={
                filtersActive
                  ? { label: 'Limpiar filtros', onClick: clearFilters, variant: 'outline' }
                  : undefined
              }
            />
          ) : (
            <>
              <div
                aria-hidden
                className={cn(
                  'hidden h-10 px-5 text-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground',
                  SCHEDULED_GRID_CLASS,
                )}
              >
                <span>Concepto</span>
                <span>Cuándo</span>
                <span>{copy.walletColumn}</span>
                <span className="text-right">Monto</span>
                <span />
              </div>
              <div className="md:border-t md:border-border/60">
                {renderRows(sections.programados)}
              </div>

              {viewPeriod ? (
                <div className="flex min-h-[52px] items-center justify-between gap-3 border-t border-border bg-muted/30 px-3.5 py-2 md:hidden">
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">Total {periodLabel}</span>
                    {viewPeriod.variableCount > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        más {viewPeriod.variableCount} con monto variable
                      </span>
                    ) : null}
                  </span>
                  <Money
                    value={viewPeriod.total}
                    tone={kind === 'income' ? 'positive' : 'neutral'}
                    className="text-[15px] font-bold"
                  />
                </div>
              ) : null}

              {sections.sinProgramar.length > 0 ? (
                <>
                  <div className={cn(SECTION_BAR_CLASS, 'min-h-11 flex-wrap py-2')}>
                    Sin programar
                    <span className="font-normal">
                      · {sections.sinProgramar.length} · no se crea solo, sirve para capturar más
                      rápido
                    </span>
                  </div>
                  {renderRows(sections.sinProgramar)}
                </>
              ) : null}

              {sections.inactivos.length > 0 ? (
                <>
                  <button
                    type="button"
                    aria-expanded={showInactive}
                    onClick={() => setShowInactive((v) => !v)}
                    className={cn(
                      SECTION_BAR_CLASS,
                      'h-12 w-full justify-between text-left hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50',
                    )}
                  >
                    <span>Inactivos · {sections.inactivos.length}</span>
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', showInactive && 'rotate-180')}
                      aria-hidden
                    />
                  </button>
                  {showInactive ? renderRows(sections.inactivos) : null}
                </>
              ) : null}
            </>
          )}
        </section>
      </div>

      {overlayElement}

      {pendingDelete ? (
        <ConfirmDeleteDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPendingDelete(null);
              setDeleteError(null);
            }
          }}
          onConfirm={handleDelete}
          title={`Eliminar ${copy.singular}`}
          description={
            kind === 'expense'
              ? 'Los gastos ya creados se conservan como gastos independientes.'
              : 'Los ingresos ya registrados se conservan. Esta acción no se puede deshacer.'
          }
          itemName={pendingDelete.item.name}
          error={deleteError}
        />
      ) : null}
    </>
  );
};
