'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import EmptyState from '@/components/EmptyState';
import { BudgetTemplateMobileCard } from '@/components/budgets/BudgetTemplateMobileCard';
import BudgetFormDialog from '@/components/BudgetFormDialog';
import BudgetAllocationsDialog from '@/components/BudgetAllocationsDialog';
import BudgetTemplateFieldsDialog from '@/components/BudgetTemplateFieldsDialog';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useFinanceContext } from '@/context/finance-context';
import {
  fetchBudgetTemplates,
  createBudget,
  deleteBudget,
  setBudgetActive,
  updateBudgetAllocations,
  updateBudgetTemplate,
} from '@/lib/api/budgets';
import {
  AlertCircle,
  LayoutList,
  Pencil,
  PiggyBank,
  Repeat2,
  RotateCcw,
  Trash2,
} from 'lucide-react';
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [allocDialogOpen, setAllocDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selected, setSelected] = useState<BudgetListItem | null>(null);
  const [nameFilter, setNameFilter] = useState('');

  const filteredTemplates = useMemo(() => {
    const query = nameFilter.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((template) => template.name.toLowerCase().includes(query));
  }, [templates, nameFilter]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setTemplates(await fetchBudgetTemplates(context));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

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

  const handleUpdateTemplate = async (values: Step1Values) => {
    if (!selected) return;
    try {
      setFormError(null);
      await updateBudgetTemplate(selected.id, values, context);
      toast.success('Plantilla actualizada');
      await fetchTemplates();
      setEditDialogOpen(false);
      setSelected(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar plantilla';
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

  const handleDeactivate = async () => {
    if (!selected) return;
    try {
      setError(null);
      await deleteBudget(selected.id, context);
      toast.success('Plantilla desactivada');
      await fetchTemplates();
      setDeleteDialogOpen(false);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al desactivar plantilla');
    }
  };

  const handleReactivate = useCallback(async (tpl: BudgetListItem) => {
    try {
      setError(null);
      await setBudgetActive(tpl.id, true, context);
      toast.success('Plantilla reactivada');
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reactivar plantilla');
    }
  }, [context, fetchTemplates]);

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
              <>
                <Repeat2
                  className="h-3.5 w-3.5 shrink-0 text-violet-500"
                  aria-hidden
                />
                <span className="sr-only">Recurrente</span>
              </>
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
        cell: ({ row }) => (
          <span className="font-mono tabular-nums">
            {formatCurrency(row.original.allocated_amount)}
          </span>
        ),
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
              {!tpl.active ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 sm:size-8"
                  onClick={() => handleReactivate(tpl)}
                  aria-label={`Reactivar ${tpl.name}`}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 sm:size-8"
                    onClick={() => { setSelected(tpl); setFormError(null); setEditDialogOpen(true); }}
                    aria-label={`Editar ${tpl.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 sm:size-8"
                    onClick={() => { setSelected(tpl); setFormError(null); setAllocDialogOpen(true); }}
                    aria-label={`Ver asignaciones de ${tpl.name}`}
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 sm:size-8"
                    onClick={() => { setSelected(tpl); setError(null); setDeleteDialogOpen(true); }}
                    aria-label={`Desactivar ${tpl.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          );
        },
      },
    ],
    [handleReactivate],
  );

  return (
    <>
      <div
        className="sticky top-16 z-20 mb-4 flex flex-col gap-3 border-b border-border/60 bg-background py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
        aria-label="Acciones de plantillas de presupuestos"
      >
        <div>
          <h2 className="text-lg font-semibold leading-tight">
            Plantillas de presupuestos
          </h2>
          <p className="text-xs text-muted-foreground">
            Define montos y asignaciones para generar nuevos periodos.
          </p>
        </div>
        <Button
          className="h-11 w-full sm:h-9 sm:w-auto"
          onClick={() => {
            setFormError(null);
            setCreateDialogOpen(true);
          }}
        >
          <PiggyBank className="mr-2 h-4 w-4" aria-hidden />
          <span className="sm:hidden">Nueva</span>
          <span className="hidden sm:inline">Nueva plantilla</span>
        </Button>
      </div>

      {error && !deleteDialogOpen ? (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <div>
            <AlertTitle>No se pudo completar la acción</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </div>
        </Alert>
      ) : null}

      <Card className="gap-0 py-0">
        <CardContent className="p-4 sm:p-6">
          {loading ? (
            <div className="space-y-4" aria-busy="true" aria-label="Cargando plantillas">
              <Skeleton className="h-9 w-full max-w-xs" />
              <div className="space-y-3 rounded-lg border p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              message="No hay plantillas de presupuesto."
              description="Crea una plantilla para definir montos, frecuencia y categorías."
              action={{
                label: 'Crear plantilla',
                onClick: () => setCreateDialogOpen(true),
              }}
            />
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                <Input
                  value={nameFilter}
                  onChange={(event) => setNameFilter(event.target.value)}
                  placeholder="Filtrar por nombre…"
                  aria-label="Filtrar plantillas por nombre"
                  className="h-10"
                />
                {filteredTemplates.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No se encontraron plantillas.
                  </p>
                ) : (
                  filteredTemplates.map((template) => (
                    <BudgetTemplateMobileCard
                      key={template.id}
                      template={template}
                      onEdit={(tpl) => {
                        setSelected(tpl);
                        setFormError(null);
                        setEditDialogOpen(true);
                      }}
                      onAllocations={(tpl) => {
                        setSelected(tpl);
                        setFormError(null);
                        setAllocDialogOpen(true);
                      }}
                      onDeactivate={(tpl) => {
                        setSelected(tpl);
                        setError(null);
                        setDeleteDialogOpen(true);
                      }}
                      onReactivate={handleReactivate}
                    />
                  ))
                )}
              </div>
              <div className="hidden md:block">
                <DataTable
                  data={templates}
                  columns={columns}
                  filterColumn="name"
                  filterPlaceholder="Filtrar por nombre…"
                  emptyMessage="No se encontraron plantillas."
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <BudgetFormDialog
        open={createDialogOpen}
        onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) setFormError(null); }}
        onSubmit={handleCreate}
        error={formError && createDialogOpen ? formError : null}
      />

      {selected && (
        <>
          <BudgetTemplateFieldsDialog
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) { setSelected(null); setFormError(null); }
            }}
            budget={selected}
            onSubmit={handleUpdateTemplate}
            error={formError && editDialogOpen ? formError : null}
          />

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
            onConfirm={handleDeactivate}
            title="Desactivar plantilla"
            description="¿Desactivar esta plantilla? Se conservará el historial de períodos y podrás reactivarla después."
            itemName={selected.name}
          />
        </>
      )}
    </>
  );
}
