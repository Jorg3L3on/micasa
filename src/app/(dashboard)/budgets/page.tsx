'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import BudgetFormDialog from '@/components/BudgetFormDialog';
import BudgetAllocationsDialog from '@/components/BudgetAllocationsDialog';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  createBudget,
  deleteBudget,
  updateBudgetAllocations,
} from '@/lib/api/budgets';
import { PiggyBank, LayoutList, Trash2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import type { BudgetListItem } from '@/types/catalog';
import type { Step1Values, Step2Values } from '@/schemas/budget.schema';
import { BUDGET_FREQUENCY_LABELS, type BudgetFrequency } from '@/schemas/budget.schema';

export default function BudgetsPage() {
  const { context } = useFinanceContext();
  const [budgets, setBudgets] = useState<BudgetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [allocDialogOpen, setAllocDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<BudgetListItem | null>(null);

  const fetchBudgets = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientFetchFromApi<BudgetListItem[]>(
        '/api/budgets',
        undefined,
        context,
      );
      setBudgets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar presupuestos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [context]);

  const handleCreate = async (step1: Step1Values, step2: Step2Values) => {
    try {
      setFormError(null);
      await createBudget(
        {
          name: step1.name,
          allocated_amount: step1.allocated_amount,
          frequency: step1.frequency,
          start_date: step1.start_date ?? null,
          end_date: step1.end_date ?? null,
          allocations: step2.allocations,
        },
        context,
      );
      toast.success('Presupuesto creado');
      await fetchBudgets();
      setCreateDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear el presupuesto';
      setFormError(message);
      throw err;
    }
  };

  const handleUpdateAllocations = async (allocations: Step2Values['allocations']) => {
    if (!selectedBudget) return;
    try {
      setFormError(null);
      await updateBudgetAllocations(selectedBudget.id, allocations, context);
      toast.success('Asignaciones actualizadas');
      await fetchBudgets();
      setAllocDialogOpen(false);
      setSelectedBudget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar asignaciones';
      setFormError(message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!selectedBudget) return;
    try {
      setError(null);
      await deleteBudget(selectedBudget.id, context);
      toast.success('Presupuesto eliminado');
      await fetchBudgets();
      setDeleteDialogOpen(false);
      setSelectedBudget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al eliminar el presupuesto';
      setError(message);
    }
  };

  const columns = useMemo<ColumnDef<BudgetListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nombre" />
        ),
        cell: ({ row }) => (
          <span className={cn('font-medium', !row.original.active && 'text-muted-foreground')}>
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: 'allocated_amount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Total" />
        ),
        cell: ({ row }) => formatCurrency(row.original.allocated_amount),
      },
      {
        accessorKey: 'spent_amount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Gastado" />
        ),
        cell: ({ row }) => formatCurrency(row.original.spent_amount),
      },
      {
        accessorKey: 'remaining_amount',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Restante" />
        ),
        cell: ({ row }) => {
          const remaining = row.original.remaining_amount;
          return (
            <span
              className={cn(
                'font-medium',
                remaining < 0 && 'text-destructive',
                remaining >= 0 && remaining < row.original.allocated_amount * 0.2 && 'text-amber-600 dark:text-amber-400',
                remaining >= row.original.allocated_amount * 0.2 && 'text-green-700 dark:text-green-400',
              )}
            >
              {formatCurrency(remaining)}
            </span>
          );
        },
      },
      {
        accessorKey: 'frequency',
        header: 'Frecuencia',
        cell: ({ row }) =>
          BUDGET_FREQUENCY_LABELS[row.original.frequency as BudgetFrequency] ??
          row.original.frequency,
      },
      {
        id: 'progress',
        header: 'Progreso',
        cell: ({ row }) => {
          const { spent_amount, allocated_amount } = row.original;
          const pct = allocated_amount > 0
            ? Math.min((spent_amount / allocated_amount) * 100, 100)
            : 0;
          const color =
            pct >= 75
              ? 'bg-destructive'
              : pct >= 50
              ? 'bg-orange-500'
              : pct >= 25
              ? 'bg-yellow-400'
              : 'bg-green-500';
          return (
            <div className="flex min-w-[110px] items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', color)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-9 text-right text-xs text-muted-foreground">
                {pct.toFixed(0)}%
              </span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Acciones</span>,
        enableHiding: false,
        cell: ({ row }) => {
          const budget = row.original;
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => {
                  setSelectedBudget(budget);
                  setFormError(null);
                  setAllocDialogOpen(true);
                }}
                aria-label={`Ver asignaciones de ${budget.name}`}
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => {
                  setSelectedBudget(budget);
                  setError(null);
                  setDeleteDialogOpen(true);
                }}
                aria-label={`Eliminar ${budget.name}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        },
      },
    ],
    [],
  );

  return (
    <>
      <div
        className="sticky top-16 z-20 mb-4 flex justify-end border-b border-border/60 bg-background py-2 shadow-sm group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
        aria-label="Acciones de presupuestos"
      >
        <Button onClick={() => { setFormError(null); setCreateDialogOpen(true); }}>
          <PiggyBank className="mr-2 h-4 w-4" />
          Agregar presupuesto
        </Button>
      </div>

      {error && !deleteDialogOpen && (
        <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando…</div>
          ) : budgets.length === 0 ? (
            <EmptyState message="No se encontraron presupuestos" />
          ) : (
            <DataTable
              data={budgets}
              columns={columns}
              filterColumn="name"
              filterPlaceholder="Filtrar por nombre…"
              emptyMessage="No se encontraron presupuestos."
            />
          )}
        </CardContent>
      </Card>

      <BudgetFormDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) setFormError(null);
        }}
        onSuccess={fetchBudgets}
        onSubmit={handleCreate}
        error={formError && createDialogOpen ? formError : null}
      />

      {selectedBudget && (
        <>
          <BudgetAllocationsDialog
            open={allocDialogOpen}
            onOpenChange={(open) => {
              setAllocDialogOpen(open);
              if (!open) { setSelectedBudget(null); setFormError(null); }
            }}
            budget={selectedBudget}
            onSubmit={handleUpdateAllocations}
            error={formError && allocDialogOpen ? formError : null}
          />

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) { setSelectedBudget(null); setError(null); }
            }}
            onConfirm={handleDelete}
            title="Eliminar presupuesto"
            description="¿Estás seguro de querer eliminar este presupuesto? Se eliminarán también todas sus asignaciones."
            itemName={selectedBudget.name}
          />
        </>
      )}
    </>
  );
}
