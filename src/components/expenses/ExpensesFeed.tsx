'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Loader2, Plus, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCurrency } from '@/lib/utils';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import ExpenseFormSheet from '@/components/expenses/ExpenseFormSheet';
import SwipeableExpenseRow from '@/components/expenses/SwipeableExpenseRow';
import RepeatChips from '@/components/expenses/RepeatChips';
import { groupByDay } from '@/components/expenses/groupByDay';
import type {
  ExpenseFeedItem,
  ExpensesRecentResponse,
} from '@/types/expenses-feed';
import type { AddExpenseFormValues } from '@/schemas/transaction.schema';

type ExpensesFeedProps = {
  initialPage: ExpensesRecentResponse;
};

type EditingState = {
  item: ExpenseFeedItem;
};

const PAGE_SIZE = 25;

/** Measured shell header + gastos chrome so sticky tops stay aligned (fixed top-16 mismatches real header height on mobile). */
const DEFAULT_STICKY_OFFSETS = { shellTop: 64, dayBandTop: 136 };

export default function ExpensesFeed({ initialPage }: ExpensesFeedProps) {
  const { context } = useFinanceContext();
  const contextKey = `${context.type}:${context.id}`;
  const initialContextKey = useRef(contextKey);

  const [items, setItems] = useState<ExpenseFeedItem[]>(initialPage.items);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialPage.nextCursor,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createDefaults, setCreateDefaults] = useState<
    Partial<AddExpenseFormValues> | undefined
  >(undefined);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [repeatConfirmItem, setRepeatConfirmItem] =
    useState<ExpenseFeedItem | null>(null);
  const [isRepeatSubmitting, setIsRepeatSubmitting] = useState(false);

  const [openRowId, setOpenRowId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ExpenseFeedItem | null>(
    null,
  );

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const stickyChromeRef = useRef<HTMLDivElement | null>(null);
  const [stickyOffsets, setStickyOffsets] = useState(DEFAULT_STICKY_OFFSETS);

  const updateStickyOffsets = useCallback(() => {
    const inset = document.querySelector('[data-slot="sidebar-inset"]');
    const shellHeader = inset?.querySelector(':scope > header');
    const chrome = stickyChromeRef.current;
    const shellH =
      shellHeader instanceof HTMLElement ? shellHeader.offsetHeight : 64;
    const rawChrome = chrome?.offsetHeight ?? 0;
    /** Avoid day-band top=shell-only before layout; Framer layers could peek above bands. */
    const chromeH = rawChrome > 0 ? rawChrome : 72;
    setStickyOffsets({
      shellTop: shellH,
      dayBandTop: shellH + chromeH,
    });
  }, []);

  useLayoutEffect(() => {
    updateStickyOffsets();
    const postLayoutId = requestAnimationFrame(() => {
      updateStickyOffsets();
    });
    const chrome = stickyChromeRef.current;
    const inset = document.querySelector('[data-slot="sidebar-inset"]');
    const shellHeader = inset?.querySelector(':scope > header');
    const ro = new ResizeObserver(() => {
      updateStickyOffsets();
    });
    if (chrome) ro.observe(chrome);
    if (shellHeader instanceof HTMLElement) ro.observe(shellHeader);
    window.addEventListener('resize', updateStickyOffsets);
    return () => {
      cancelAnimationFrame(postLayoutId);
      ro.disconnect();
      window.removeEventListener('resize', updateStickyOffsets);
    };
  }, [updateStickyOffsets]);

  // Refetch first page when owner context changes (but skip initial mount if context matches SSR).
  useEffect(() => {
    if (contextKey === initialContextKey.current) return;
    let cancelled = false;
    const load = async () => {
      setIsInitialLoading(true);
      setLoadError(null);
      try {
        const res = await clientFetchFromApi<ExpensesRecentResponse>(
          `/api/expenses/recent?limit=${PAGE_SIZE}`,
          undefined,
          context,
        );
        if (cancelled) return;
        setItems(res.items);
        setNextCursor(res.nextCursor);
        setOpenRowId(null);
        setPendingDelete(null);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : 'Error al cargar gastos',
        );
      } finally {
        if (!cancelled) setIsInitialLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [context, contextKey]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !nextCursor) return;
    setIsLoadingMore(true);
    try {
      const qs = new URLSearchParams({
        limit: String(PAGE_SIZE),
        cursor: nextCursor,
      }).toString();
      const res = await clientFetchFromApi<ExpensesRecentResponse>(
        `/api/expenses/recent?${qs}`,
        undefined,
        context,
      );
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const appended = res.items.filter((i) => !seen.has(i.id));
        return [...prev, ...appended];
      });
      setNextCursor(res.nextCursor);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Error al cargar más gastos',
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [context, isLoadingMore, nextCursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            loadMore();
          }
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  const groups = useMemo(() => groupByDay(items), [items]);

  const handleCreate = async (values: AddExpenseFormValues) => {
    setCreateError(null);
    const tempId = -Date.now();
    const optimistic: ExpenseFeedItem = {
      id: tempId,
      description: values.name,
      amount: values.amount,
      date: values.date,
      category: null,
      categoryIcon: null,
      paymentMethod: null,
      walletType: null,
      isPaid: values.isPaid,
      isRecurring: values.isRecurring,
      creditInstallmentCurrent: null,
      creditInstallmentTotal: null,
      categoryId: values.categoryId,
      walletId: values.paymentMethodId,
    };
    if (values.isPaid) {
      setItems((prev) => [optimistic, ...prev]);
    }
    try {
      const created = await clientFetchFromApi<ExpenseFeedItem>(
        '/api/expenses',
        {
          method: 'POST',
          body: JSON.stringify(values),
        },
        context,
      );
      if (created.isPaid) {
        setItems((prev) => {
          const replaced = prev.map((i) => (i.id === tempId ? created : i));
          return values.isPaid ? replaced : [created, ...replaced];
        });
      } else {
        setItems((prev) => prev.filter((i) => i.id !== tempId));
      }
      setCreateOpen(false);
    } catch (err) {
      setItems((prev) => prev.filter((i) => i.id !== tempId));
      setCreateError(
        err instanceof Error ? err.message : 'No se pudo crear el gasto',
      );
      throw err;
    }
  };

  const handleUpdate = async (values: AddExpenseFormValues) => {
    if (!editing) return;
    setEditError(null);
    const originalId = editing.item.id;
    const previous = items;
    setItems((prev) =>
      values.isPaid
        ? prev.map((i) =>
            i.id === originalId
              ? {
                  ...i,
                  description: values.name,
                  amount: values.amount,
                  date: values.date,
                  isRecurring: values.isRecurring,
                }
              : i,
          )
        : prev.filter((i) => i.id !== originalId),
    );
    try {
      await clientFetchFromApi(
        `/api/transactions?id=${originalId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            description: values.name,
            amount: values.amount,
            category_id: values.categoryId,
            wallet_id: values.paymentMethodId,
            is_paid: values.isPaid,
            payment_date: values.isPaid
              ? values.date
              : null,
          }),
        },
        context,
      );
      setEditing(null);
    } catch (err) {
      setItems(previous);
      setEditError(
        err instanceof Error ? err.message : 'No se pudo actualizar el gasto',
      );
      throw err;
    }
  };

  const executeRepeatFromPill = useCallback(
    async (source: ExpenseFeedItem) => {
      setCreateError(null);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const tempId = -Date.now();
      const optimistic: ExpenseFeedItem = {
        ...source,
        id: tempId,
        date: today,
        isRecurring: false,
        creditInstallmentCurrent: null,
        creditInstallmentTotal: null,
      };
      setItems((prev) => [optimistic, ...prev]);
      try {
        const created = await clientFetchFromApi<ExpenseFeedItem>(
          '/api/expenses/duplicate',
          {
            method: 'POST',
            body: JSON.stringify({ id: source.id }),
          },
          context,
        );
        setItems((prev) => prev.map((i) => (i.id === tempId ? created : i)));
      } catch (err) {
        setItems((prev) => prev.filter((i) => i.id !== tempId));
        setLoadError(
          err instanceof Error ? err.message : 'No se pudo repetir el gasto',
        );
        throw err;
      }
    },
    [context],
  );

  const handleConfirmRepeatPill = useCallback(async () => {
    if (!repeatConfirmItem) return;
    setIsRepeatSubmitting(true);
    try {
      await executeRepeatFromPill(repeatConfirmItem);
      setRepeatConfirmItem(null);
    } catch {
    } finally {
      setIsRepeatSubmitting(false);
    }
  }, [executeRepeatFromPill, repeatConfirmItem]);

  const handleCustomizeRepeat = (source: ExpenseFeedItem) => {
    if (source.categoryId == null || source.walletId == null) return;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    setCreateError(null);
    setCreateDefaults({
      name: source.description,
      amount: source.amount,
      categoryId: source.categoryId,
      paymentMethodId: source.walletId,
      date: today,
      isPaid: true,
      isRecurring: false,
      applyToBothFortnights: false,
    });
    setCreateOpen(true);
  };

  const deleteExpenseById = useCallback(async (id: number) => {
    let previous: ExpenseFeedItem[] = [];
    setItems((prev) => {
      previous = prev;
      return prev.filter((i) => i.id !== id);
    });
    try {
      await clientFetchFromApi(
        `/api/transactions?id=${id}`,
        { method: 'DELETE' },
        context,
      );
    } catch (err) {
      setItems(previous);
      throw err;
    }
  }, [context]);

  const handleDelete = async () => {
    if (!editing) return;
    const originalId = editing.item.id;
    try {
      await deleteExpenseById(originalId);
      setEditing(null);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'No se pudo eliminar el gasto',
      );
      throw err;
    }
  };

  const editDefaults = editing
    ? {
        name: editing.item.description,
        amount: editing.item.amount,
        date: editing.item.date,
        isPaid: true,
        isRecurring: editing.item.isRecurring,
        applyToBothFortnights: false,
      }
    : undefined;

  const handleOpenCreate = useCallback(() => {
    setCreateError(null);
    setCreateDefaults(undefined);
    setCreateOpen(true);
  }, []);

  return (
    <div className="space-y-4 pb-24">
      <div
        ref={stickyChromeRef}
        className="sticky z-40 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background px-4 py-2 shadow-sm"
        style={{ top: stickyOffsets.shellTop }}
        aria-label="Acciones de gastos"
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">Gastos</h2>
          <p className="text-xs text-muted-foreground">
            Gastos pagados por día en tu contexto actual.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 sm:hidden"
                onClick={handleOpenCreate}
                aria-label="Agregar gasto"
              >
                <Plus className="h-4 w-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Agregar gasto</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            className="hidden h-9 gap-1.5 rounded-xl sm:inline-flex"
            onClick={handleOpenCreate}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Agregar gasto
          </Button>
        </div>
      </div>

      <div className="relative z-0 py-4">
        {isInitialLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Cargando...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Coins className="size-7" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium">Aún no hay gastos</p>
              <p className="text-sm text-muted-foreground">
                Registra el primero para verlo aquí.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleOpenCreate}
              className="h-9 gap-1.5 rounded-xl"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Agregar gasto
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <RepeatChips
              items={items}
              onRepeat={setRepeatConfirmItem}
              onCustomize={handleCustomizeRepeat}
            />
            {groups.map((group) => (
              <section key={group.key} className="flex flex-col gap-2">
                <div
                  className="sticky z-30 -mx-4 border-b border-border/60 bg-background px-4 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground shadow-sm"
                  style={{ top: stickyOffsets.dayBandTop }}
                >
                  {group.label}
                </div>
                <div className="flex flex-col gap-2">
                  {group.items.map((item) => (
                    <SwipeableExpenseRow
                      key={item.id}
                      expense={item}
                      pending={item.id < 0}
                      isOpen={openRowId === item.id}
                      onOpenChange={(open) => {
                        setOpenRowId((current) => {
                          if (open) return item.id;
                          if (current === item.id) return null;
                          return current;
                        });
                      }}
                      onCardClick={
                        item.id > 0
                          ? () => {
                              setEditError(null);
                              setEditing({ item });
                            }
                          : undefined
                      }
                      onRequestDelete={setPendingDelete}
                    />
                  ))}
                </div>
              </section>
            ))}

            {loadError && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {loadError}
              </div>
            )}

            <div
              ref={sentinelRef}
              className="py-6 text-center text-xs text-muted-foreground"
              aria-live="polite"
            >
              {isLoadingMore
                ? 'Cargando más...'
                : nextCursor
                  ? ' '
                  : 'No hay más gastos'}
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        open={repeatConfirmItem != null}
        onOpenChange={(open) => {
          if (!open && !isRepeatSubmitting) {
            setRepeatConfirmItem(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Registrar este gasto hoy?</AlertDialogTitle>
            <AlertDialogDescription className="grid gap-2">
              <span>
                Se creará un movimiento para hoy con el mismo monto, categoría y
                forma de pago.
              </span>
              {repeatConfirmItem ? (
                <span className="font-semibold text-foreground">
                  {repeatConfirmItem.description} —{' '}
                  {formatCurrency(repeatConfirmItem.amount)}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRepeatSubmitting}>
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={isRepeatSubmitting}
              className="rounded-xl"
              onClick={() => void handleConfirmRepeatPill()}
            >
              {isRepeatSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Registrando…
                </>
              ) : (
                'Sí, registrar'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDeleteDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Eliminar gasto"
        description="Esta acción no se puede deshacer."
        itemName={
          pendingDelete
            ? `${pendingDelete.description} — ${formatCurrency(pendingDelete.amount)}`
            : undefined
        }
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteExpenseById(pendingDelete.id);
            setPendingDelete(null);
            setOpenRowId(null);
          } catch (err) {
            setLoadError(
              err instanceof Error
                ? err.message
                : 'No se pudo eliminar el gasto',
            );
          }
        }}
      />

      <ExpenseFormSheet
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setCreateError(null);
            setCreateDefaults(undefined);
          }
        }}
        mode="create"
        title={createDefaults ? 'Repetir gasto' : 'Agregar gasto'}
        description={
          createDefaults
            ? 'Revisa los datos y confirma.'
            : 'Registra un gasto; asignamos la quincena automáticamente.'
        }
        defaults={createDefaults}
        onSubmit={handleCreate}
        error={createError}
      />

      <ExpenseFormSheet
        open={editing != null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setEditError(null);
          }
        }}
        mode="edit"
        title="Editar gasto"
        defaults={editDefaults}
        onSubmit={handleUpdate}
        onDelete={handleDelete}
        error={editError}
      />
    </div>
  );
}
