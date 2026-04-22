'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api';
import ExpenseCard from '@/components/expenses/ExpenseCard';
import ExpenseFormSheet from '@/components/expenses/ExpenseFormSheet';
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
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

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
      paymentMethod: null,
      walletType: null,
      isRecurring: values.isRecurring,
      creditInstallmentCurrent: null,
      creditInstallmentTotal: null,
    };
    setItems((prev) => [optimistic, ...prev]);
    try {
      const created = await clientFetchFromApi<ExpenseFeedItem>(
        '/api/expenses',
        {
          method: 'POST',
          body: JSON.stringify(values),
        },
        context,
      );
      setItems((prev) =>
        prev.map((i) => (i.id === tempId ? created : i)),
      );
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
      prev.map((i) =>
        i.id === originalId
          ? {
              ...i,
              description: values.name,
              amount: values.amount,
              date: values.date,
              isRecurring: values.isRecurring,
            }
          : i,
      ),
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
              ? `${values.date}T00:00:00.000Z`
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

  const handleDelete = async () => {
    if (!editing) return;
    const originalId = editing.item.id;
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== originalId));
    try {
      await clientFetchFromApi(
        `/api/transactions?id=${originalId}`,
        { method: 'DELETE' },
        context,
      );
      setEditing(null);
    } catch (err) {
      setItems(previous);
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

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <h1 className="text-lg font-semibold">Gastos</h1>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setCreateError(null);
            setCreateOpen(true);
          }}
          className="gap-1.5"
        >
          <Plus className="size-4" aria-hidden />
          <span>Agregar gasto</span>
        </Button>
      </header>

      <div className="flex-1 px-4 py-4">
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
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="size-4" aria-hidden />
              Agregar gasto
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <section key={group.key} className="flex flex-col gap-2">
                <div className="sticky top-[57px] z-[5] -mx-4 bg-background/95 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/75">
                  {group.label}
                </div>
                <div className="flex flex-col gap-2">
                  {group.items.map((item) => (
                    <ExpenseCard
                      key={item.id}
                      expense={item}
                      pending={item.id < 0}
                      onClick={
                        item.id > 0
                          ? () => {
                              setEditError(null);
                              setEditing({ item });
                            }
                          : undefined
                      }
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

      <ExpenseFormSheet
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateError(null);
        }}
        mode="create"
        title="Agregar gasto"
        description="Registra un gasto; asignamos la quincena automáticamente."
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
