'use client';

import { ErrorBanner } from '@/components/error-banner';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import EmptyState from '@/components/EmptyState';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { TemplateSwipeRow } from '@/components/settings/TemplateSwipeRow';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { deleteIncomeTemplate } from '@/lib/api/incomes';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Money } from '@/components/money';
import type { IncomeTemplateListItem } from '@/types/catalog';
import { useRegisterToolbarActions } from '@/context/toolbar-actions-context';

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
      `/settings/income-templates/${template.id}/edit${queryString ? `?${queryString}` : ''}`,
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
          row.original.suggestedAmount != null ? (
            <Money
              value={row.original.suggestedAmount}
              size="row"
              tone="positive"
              className="block text-right"
            />
          ) : (
            '—'
          ),
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
                ? 'bg-status-success-soft text-status-success'
                : 'bg-muted text-muted-foreground'
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
                <Pencil className="h-4 w-4" data-icon="inline-start" />
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden md:inline-flex"
                    onClick={() => openDeleteDialog(template)}
                    aria-label={`Eliminar ${template.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" data-icon="inline-start" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Eliminar</TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [handleEdit, openDeleteDialog]
  );

  const handleCreateTemplate = useCallback(() => {
    router.push(
      `/settings/income-templates/new${queryString ? `?${queryString}` : ''}`,
    );
  }, [queryString, router]);

  const primaryActionIcon = useMemo(
    () => <Plus data-icon="inline-start" />,
    [],
  );

  useRegisterToolbarActions({
    primaryAction: {
      label: 'Agregar plantilla de ingreso',
      onClick: handleCreateTemplate,
      icon: primaryActionIcon,
    },
  });

  return (
    <>
      <div className="space-y-5">
      {error && !deleteDialogOpen && (
        <ErrorBanner>{error}</ErrorBanner>
      )}

      <Card>
        <CardContent className="py-4">
          {loading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Cargando">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <EmptyState message="No se encontraron plantillas de ingresos" />
          ) : (
            <DataTable
              embedded
              data={templates}
              columns={columns}
              filterColumn="name"
              filterPlaceholder="Filtrar por nombre…"
              columnVisibility
              emptyMessage="No se encontraron plantillas de ingresos."
              renderMobileRow={(template) => (
                <TemplateSwipeRow
                  name={template.name}
                  subtitle={template.source ?? undefined}
                  amount={template.suggestedAmount}
                  tone="positive"
                  active={template.active}
                  onEdit={() => handleEdit(template)}
                  onRequestDelete={() => openDeleteDialog(template)}
                />
              )}
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
