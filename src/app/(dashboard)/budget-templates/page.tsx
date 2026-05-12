'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import BudgetFormDialog from '@/components/BudgetFormDialog';
import BudgetAllocationsDialog from '@/components/BudgetAllocationsDialog';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useFinanceContext } from '@/context/finance-context';
import {
  fetchBudgetTemplates,
  createBudget,
  deleteBudget,
  updateBudgetAllocations,
} from '@/lib/api/budgets';
import { PiggyBank, LayoutList, Trash2, Repeat2 } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import type { BudgetListItem } from '@/types/catalog';
import type { Step1Values, Step2Values } from '@/schemas/budget.schema';
import { BUDGET_FREQUENCY_LABELS, type BudgetFrequency } from '@/schemas/budget.schema';

export default function BudgetTemplatesPage() {
  const { context } = useFinanceContext();
  const [templates, setTemplates] = useState<BudgetListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [allocDialogOpen, setAllocDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selected, setSelected] = useState<BudgetListItem | null>(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      setTemplates(await fetchBudgetTemplates(context));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, [context]);

  const handleCreate = async (step1: Step1Values, step2: Step2Values) => {
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
      toast.success('Plantilla creada');
      await fetchTemplates();
      setCreateDialogOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al crear plantilla';
      setFormError(message);
      throw err;
    }
  };

  const handleUpdateAllocations = async (allocations: Step2Values['allocations']) => {
    if (!selected) return;
    try {
      setFormError(null);
      await updateBudgetAllocations(selected.id, allocations, context);
      toast.success('Asignaciones actualizadas');
      await fetchTemplates();
      setAllocDialogOpen(false);
      setSelected(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar asignaciones';
      setFormError(message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      setError(null);
      await deleteBudget(selected.id, context);
      toast.success('Plantilla eliminada');
      await fetchTemplates();
      setDeleteDialogOpen(false);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar plantilla');
    }
  };

  const columns = useMemo<ColumnDef<BudgetListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className={cn('font-medium', !row.original.active && 'text-muted-foreground')}>
              {row.original.name}
            </span>
            {row.original.recurrent && (
              <Repeat2 className="h-3.5 w-3.5 shrink-0 text-violet-500" aria-label="Recurrente" />
            )}
          </div>
        ),
      },
      {
        accessorKey: 'frequency',
        header: 'Frecuencia',
        cell: ({ row }) =>
          BUDGET_FREQUENCY_LABELS[row.original.frequency as BudgetFrequency] ?? row.original.frequency,
      },
      {
        accessorKey: 'allocated_amount',
        header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
        cell: ({ row }) => formatCurrency(row.original.allocated_amount),
      },
      {
        id: 'status',
        header: 'Estado',
        cell: ({ row }) => (
          <Badge variant={row.original.active ? 'default' : 'secondary'}>
            {row.original.active ? 'Activo' : 'Inactivo'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Acciones</span>,
        enableHiding: false,
        cell: ({ row }) => {
          const tpl = row.original;
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => { setSelected(tpl); setFormError(null); setAllocDialogOpen(true); }}
                aria-label={`Ver asignaciones de ${tpl.name}`}
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => { setSelected(tpl); setError(null); setDeleteDialogOpen(true); }}
                aria-label={`Eliminar ${tpl.name}`}
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
        aria-label="Acciones de plantillas de presupuestos"
      >
        <Button onClick={() => { setFormError(null); setCreateDialogOpen(true); }}>
          <PiggyBank className="mr-2 h-4 w-4" />
          Nueva plantilla
        </Button>
      </div>

      {error && !deleteDialogOpen && (
        <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Cargando…</div>
          ) : templates.length === 0 ? (
            <EmptyState message="No se encontraron plantillas de presupuesto." />
          ) : (
            <DataTable
              data={templates}
              columns={columns}
              filterColumn="name"
              filterPlaceholder="Filtrar por nombre…"
              emptyMessage="No se encontraron plantillas."
            />
          )}
        </CardContent>
      </Card>

      <BudgetFormDialog
        open={createDialogOpen}
        onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) setFormError(null); }}
        onSuccess={fetchTemplates}
        onSubmit={handleCreate}
        error={formError && createDialogOpen ? formError : null}
      />

      {selected && (
        <>
          <BudgetAllocationsDialog
            open={allocDialogOpen}
            onOpenChange={(open) => {
              setAllocDialogOpen(open);
              if (!open) { setSelected(null); setFormError(null); }
            }}
            budget={selected}
            onSubmit={handleUpdateAllocations}
            error={formError && allocDialogOpen ? formError : null}
          />

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) { setSelected(null); setError(null); }
            }}
            onConfirm={handleDelete}
            title="Eliminar plantilla"
            description="¿Estás seguro de querer eliminar esta plantilla? Se eliminarán también todos sus períodos e historial."
            itemName={selected.name}
          />
        </>
      )}
    </>
  );
}
