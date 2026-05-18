'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { deleteIncomeTemplate } from '@/lib/api/incomes';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { IncomeTemplateListItem } from '@/types/catalog';

export default function IncomeTemplatesPage() {
  const { context } = useFinanceContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [templates, setTemplates] = useState<IncomeTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<IncomeTemplateListItem | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientFetchFromApi<IncomeTemplateListItem[]>(
        '/api/income-templates',
        undefined,
        context,
      );
      setTemplates(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar los datos',
      );
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    try {
      setError(null);
      await deleteIncomeTemplate(selectedTemplate.id, context);
      toast.success('Plantilla de ingresos eliminada');
      await fetchData();
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Error al eliminar la plantilla de ingresos';
      if (
        message.includes('409') ||
        message.includes('en uso') ||
        message.includes('Conflict')
      ) {
        setError('La plantilla de ingresos está en uso y no puede eliminarse');
      } else {
        setError(message);
      }
    }
  };

  const handleEdit = useCallback((template: IncomeTemplateListItem) => {
    router.push(
      `/income-templates/${template.id}/edit${queryString ? `?${queryString}` : ''}`,
    );
  }, [queryString, router]);

  const openDeleteDialog = useCallback((template: IncomeTemplateListItem) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
    setError(null);
  }, []);

  const columns = useMemo<ColumnDef<IncomeTemplateListItem>[]>(
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
        accessorKey: 'suggestedAmount',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Monto sugerido"
            className="text-right"
          />
        ),
        cell: ({ row }) =>
          row.original.suggestedAmount != null
            ? formatCurrency(row.original.suggestedAmount)
            : '—',
      },
      {
        accessorKey: 'source',
        header: 'Origen',
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.source ?? '—'}
          </span>
        ),
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
                onClick={() => handleEdit(template)}
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
    [handleEdit, openDeleteDialog]
  );

  return (
    <>
      <div
        className="sticky top-16 z-40 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background px-4 py-2 shadow-sm group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
        aria-label="Plantillas de ingresos"
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">
            Plantillas de ingresos
          </h2>
          <p className="text-xs text-muted-foreground">
            Ingresos recurrentes y montos sugeridos por quincena en tu contexto.
          </p>
        </div>
        <Button
          className="h-9 shrink-0 rounded-xl"
          onClick={() =>
            router.push(
              `/income-templates/new${queryString ? `?${queryString}` : ''}`,
            )
          }
          aria-label="Agregar plantilla de ingresos"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Agregar plantilla
        </Button>
      </div>

      <div className="relative z-0">
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
            <EmptyState message="No se encontraron plantillas de ingresos" />
          ) : (
            <DataTable
              data={templates}
              columns={columns}
              filterColumn="name"
              filterPlaceholder="Filtrar por nombre..."
              columnVisibility
              emptyMessage="No se encontraron plantillas de ingresos."
            />
          )}
        </CardContent>
      </Card>
      </div>

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
          title="Eliminar plantilla de ingresos"
          description="¿Estás seguro de querer eliminar esta plantilla de ingresos? Esta acción no puede deshacerse."
          itemName={selectedTemplate.name}
        />
      )}
    </>
  );
}
