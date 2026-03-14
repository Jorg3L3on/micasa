'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi, deleteExpenseTemplate } from '@/lib/api';
import { Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { ExpenseTemplateListItem } from '@/types/catalog';

export default function ExpenseTemplatesPage() {
  const { context } = useFinanceContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [templates, setTemplates] = useState<ExpenseTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ExpenseTemplateListItem | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const templatesData = await clientFetchFromApi<ExpenseTemplateListItem[]>(
        '/api/expense-templates',
        undefined,
        context,
      );
      setTemplates(templatesData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar los datos',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [context]);

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    try {
      setError(null);
      await deleteExpenseTemplate(selectedTemplate.id, context);
      toast.success('Plantilla de gasto eliminada');
      await fetchData();
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al eliminar la plantilla de gasto';
      if (
        message.includes('409') ||
        message.includes('in use') ||
        message.includes('Conflict')
      ) {
        setError('La plantilla de gasto está en uso y no puede eliminarse');
      } else {
        setError(message);
      }
    }
  };

  const openEditDialog = (template: ExpenseTemplateListItem) => {
    router.push(`/expense-templates/${template.id}/edit${queryString ? `?${queryString}` : ''}`);
  };

  const openDeleteDialog = (template: ExpenseTemplateListItem) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
    setError(null);
  };

  const columns = useMemo<ColumnDef<ExpenseTemplateListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nombre" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Categoría',
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.category}</span>
        ),
      },
      {
        accessorKey: 'totalEstimatedAmount',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Total estimado"
            className="text-right"
          />
        ),
        cell: ({ row }) => (
          <span className="text-right font-medium">
            {formatCurrency(row.original.totalEstimatedAmount ?? 0)}
          </span>
        ),
      },
      {
        accessorKey: 'cutoffDay',
        header: 'Día de corte',
        cell: ({ row }) => row.original.cutoffDay ?? '—',
      },
      {
        accessorKey: 'dueDay',
        header: 'Día de pago',
        cell: ({ row }) => row.original.dueDay ?? '—',
      },
      {
        accessorKey: 'isRecurring',
        header: 'Recurrente',
        cell: ({ row }) => (row.original.isRecurring ? 'Sí' : 'No'),
      },
      {
        accessorKey: 'appliesFirstFortnight',
        header: 'Primera quincena',
        cell: ({ row }) =>
          row.original.appliesFirstFortnight ? 'Sí' : 'No',
      },
      {
        accessorKey: 'appliesSecondFortnight',
        header: 'Segunda quincena',
        cell: ({ row }) =>
          row.original.appliesSecondFortnight ? 'Sí' : 'No',
      },
      {
        accessorKey: 'isSubscription',
        header: 'Es una suscripción',
        cell: ({ row }) => (row.original.isSubscription ? 'Sí' : 'No'),
      },
      {
        accessorKey: 'active',
        header: 'Activo',
        cell: ({ row }) => (
          <span
            className={`px-2 py-1 text-xs font-semibold rounded-full ${
              row.original.active
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
            }`}
          >
            {row.original.active ? 'Activo' : 'Inactivo'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="text-right">Acciones</span>,
        enableHiding: false,
        cell: ({ row }) => {
          const template = row.original;
          return (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(template)}
                aria-label={`Editar ${template.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openDeleteDialog(template)}
                aria-label={`Eliminar ${template.name}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        },
      },
    ],
    [queryString, openEditDialog, openDeleteDialog]
  );

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={() => router.push(`/expense-templates/new${queryString ? `?${queryString}` : ''}`)}>
          Agregar plantilla de gastos
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
            <div className="py-8 text-center text-muted-foreground">
              Cargando...
            </div>
          ) : templates.length === 0 ? (
            <EmptyState message="No se encontraron plantillas de gastos" />
          ) : (
            <DataTable
              data={templates}
              columns={columns}
              filterColumn="name"
              filterPlaceholder="Filtrar por nombre..."
              columnVisibility
              emptyMessage="No se encontraron plantillas de gastos."
            />
          )}
        </CardContent>
      </Card>

      {selectedTemplate && (
        <ConfirmDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setSelectedTemplate(null);
              setError(null);
            }
          }}
          onConfirm={handleDelete}
          title="Eliminar plantilla de gastos"
          description="¿Estás seguro de querer eliminar esta plantilla de gastos? Esta acción no puede deshacerse."
          itemName={selectedTemplate.name}
        />
      )}
    </>
  );
}
