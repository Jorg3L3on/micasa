'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EmptyState from '@/components/EmptyState';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi, type ClientApiError } from '@/lib/api/client-fetch';
import { deleteExpenseTemplate } from '@/lib/api/expense-templates';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { ExpenseTemplateListItem } from '@/types/catalog';
import {
  CategoryLabel,
  formatCategoryLabel,
} from '@/components/categories/CategoryLabel';

export default function ExpenseTemplatesPage() {
  const { context } = useFinanceContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const [templates, setTemplates] = useState<ExpenseTemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ExpenseTemplateListItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'recurring' | 'subscription'>('all');

  const fetchData = useCallback(async () => {
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
  }, [context]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    try {
      setDeleteError(null);
      await deleteExpenseTemplate(selectedTemplate.id, context);
      toast.success('Plantilla de gasto eliminada');
      await fetchData();
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
    } catch (err) {
      const apiErr = err as ClientApiError;
      const message =
        err instanceof Error
          ? err.message
          : 'Error al eliminar la plantilla de gasto';
      const displayMessage =
        apiErr.status === 409 ||
        /en uso|in use|conflict/i.test(message)
          ? 'La plantilla de gasto está en uso y no puede eliminarse'
          : message;
      setDeleteError(displayMessage);
      toast.error(displayMessage);
    }
  };

  const openEditDialog = useCallback((template: ExpenseTemplateListItem) => {
    router.push(`/expense-templates/${template.id}/edit${queryString ? `?${queryString}` : ''}`);
  }, [queryString, router]);

  const openDeleteDialog = useCallback((template: ExpenseTemplateListItem) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
    setDeleteError(null);
  }, []);

  const categories = useMemo(
    () =>
      [...new Set(templates.map((t) => t.category))].filter(Boolean).sort() as string[],
    [templates],
  );
  const categoryIcons = useMemo(() => {
    const icons = new Map<string, string | null>();
    for (const template of templates) {
      if (template.category && !icons.has(template.category)) {
        icons.set(template.category, template.categoryIcon ?? null);
      }
    }
    return icons;
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (typeFilter === 'recurring' && !t.isRecurring) return false;
      if (typeFilter === 'subscription' && !t.isSubscription) return false;
      return true;
    });
  }, [templates, categoryFilter, typeFilter]);

  const columns = useMemo<ColumnDef<ExpenseTemplateListItem>[]>(
    () => [
      {
        accessorKey: 'name',
        minSize: 140,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Nombre" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'category',
        minSize: 100,
        header: 'Categoría',
        cell: ({ row }) => (
          <CategoryLabel
            name={row.original.category}
            icon={row.original.categoryIcon}
            className="text-muted-foreground"
          />
        ),
      },
      {
        accessorKey: 'totalEstimatedAmount',
        minSize: 100,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title="Total est."
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
        minSize: 72,
        header: 'Corte',
        cell: ({ row }) => row.original.cutoffDay ?? '—',
      },
      {
        id: 'dueDays',
        minSize: 100,
        header: 'Pago',
        cell: ({ row }) => {
          const t = row.original;
          const parts: string[] = [];
          if (t.appliesFirstFortnight && t.dueDayFirst != null) {
            parts.push(`1ª: ${t.dueDayFirst}`);
          }
          if (t.appliesSecondFortnight && t.dueDaySecond != null) {
            parts.push(`2ª: ${t.dueDaySecond}`);
          }
          if (parts.length > 0) {
            return parts.join(' · ');
          }
          return t.dueDay != null ? String(t.dueDay) : '—';
        },
      },
      {
        accessorKey: 'isRecurring',
        minSize: 72,
        header: 'Recurr.',
        cell: ({ row }) => (row.original.isRecurring ? 'Sí' : 'No'),
      },
      {
        accessorKey: 'appliesFirstFortnight',
        minSize: 72,
        header: '1ª Q',
        cell: ({ row }) =>
          row.original.appliesFirstFortnight ? 'Sí' : 'No',
      },
      {
        accessorKey: 'appliesSecondFortnight',
        minSize: 72,
        header: '2ª Q',
        cell: ({ row }) =>
          row.original.appliesSecondFortnight ? 'Sí' : 'No',
      },
      {
        accessorKey: 'isSubscription',
        minSize: 72,
        header: 'Suscrip.',
        cell: ({ row }) => (row.original.isSubscription ? 'Sí' : 'No'),
      },
      {
        accessorKey: 'active',
        minSize: 72,
        header: 'Activo',
        cell: ({ row }) => (
          <span
            className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
              row.original.active
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
            }`}
          >
            {row.original.active ? 'Sí' : 'No'}
          </span>
        ),
      },
      {
        id: 'actions',
        minSize: 88,
        header: () => <span className="sr-only">Acciones</span>,
        enableHiding: false,
        cell: ({ row }) => {
          const template = row.original;
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => openEditDialog(template)}
                aria-label={`Editar ${template.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
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
    [openEditDialog, openDeleteDialog]
  );

  const addButton = (
    <Button
      className="h-9 shrink-0 rounded-xl"
      onClick={() =>
        router.push(
          `/expense-templates/new${queryString ? `?${queryString}` : ''}`,
        )
      }
      aria-label="Agregar plantilla de gastos"
    >
      <Plus className="h-4 w-4" aria-hidden />
      Agregar plantilla
    </Button>
  );

  const filterSlot = (
    <>
      <Select
        value={categoryFilter || 'all'}
        onValueChange={(v) => setCategoryFilter(v === 'all' ? '' : v)}
      >
        <SelectTrigger size="sm" className="w-[180px]" aria-label="Filtrar por categoría">
          <SelectValue placeholder="Categoría" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las categorías</SelectItem>
          {categories.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {formatCategoryLabel(cat, categoryIcons.get(cat))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={typeFilter}
        onValueChange={(v) => setTypeFilter(v as 'all' | 'recurring' | 'subscription')}
      >
        <SelectTrigger size="sm" className="w-[140px]" aria-label="Filtrar por tipo">
          <SelectValue placeholder="Tipo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          <SelectItem value="recurring">Recurrentes</SelectItem>
          <SelectItem value="subscription">Suscripciones</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <>
      <div
        className="sticky top-16 z-40 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-background px-4 py-2 shadow-sm group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
        aria-label="Plantillas de gastos"
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">
            Plantillas de gastos
          </h2>
          <p className="text-xs text-muted-foreground">
            Recurrentes, suscripciones y montos estimados en tu contexto actual.
          </p>
        </div>
        <div className="flex shrink-0">{addButton}</div>
      </div>

      <div className="relative z-0">
      {error && (
        <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-6">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              Cargando...
            </div>
          ) : templates.length === 0 ? (
            <EmptyState message="No se encontraron plantillas de gastos" />
          ) : (
            <DataTable
              data={filteredTemplates}
              columns={columns}
              filterColumn="name"
              filterPlaceholder="Filtrar por nombre..."
              filterSlot={filterSlot}
              columnVisibility
              emptyMessage="No se encontraron plantillas de gastos."
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
              setDeleteError(null);
            }
          }}
          onConfirm={handleDelete}
          title="Eliminar plantilla de gastos"
          description="¿Estás seguro de querer eliminar esta plantilla de gastos? Esta acción no puede deshacerse."
          itemName={selectedTemplate.name}
          error={deleteError}
        />
      )}
    </>
  );
}
