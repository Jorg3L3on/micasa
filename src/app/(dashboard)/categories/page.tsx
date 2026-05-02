'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, DataTableColumnHeader } from '@/components/ui/data-table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import CategoryForm from '@/components/CategoryForm';
import { CategoryFormValues } from '@/schemas/category.schema';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '@/lib/api/categories';
import { Pencil, Trash2 } from 'lucide-react';
import type { CategoryOption } from '@/types/catalog';

export default function CategoriesPage() {
  const { context } = useFinanceContext();
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryOption | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientFetchFromApi<CategoryOption[]>(
        '/api/categories',
        undefined,
        context,
      );
      setCategories(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar las categorías',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [context]);

  const handleCreate = async (data: CategoryFormValues) => {
    try {
      setFormError(null);
      await createCategory(data, context);
      toast.success('Categoría creada');
      await fetchCategories();
      setCreateDialogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al crear la categoría';
      setFormError(message);
      throw err;
    }
  };

  const handleEdit = async (data: CategoryFormValues) => {
    if (!selectedCategory) return;
    try {
      setFormError(null);
      await updateCategory(selectedCategory.id, data, context);
      toast.success('Categoría actualizada');
      await fetchCategories();
      setEditDialogOpen(false);
      setSelectedCategory(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al actualizar la categoría';
      setFormError(message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    try {
      setError(null);
      await deleteCategory(selectedCategory.id, context);
      toast.success('Categoría eliminada');
      await fetchCategories();
      setDeleteDialogOpen(false);
      setSelectedCategory(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al eliminar la categoría';
      if (
        message.includes('409') ||
        message.includes('in use') ||
        message.includes('Conflict')
      ) {
        setError('La categoría está en uso y no puede eliminarse');
      } else {
        setError(message);
      }
    }
  };

  const openEditDialog = (category: CategoryOption) => {
    setSelectedCategory(category);
    setEditDialogOpen(true);
    setFormError(null);
  };

  const openDeleteDialog = (category: CategoryOption) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
    setError(null);
  };

  const columns = useMemo<ColumnDef<CategoryOption>[]>(
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
        accessorKey: 'description',
        header: 'Descripción',
        cell: ({ row }) => row.original.description ?? '',
      },
      {
        id: 'actions',
        header: () => <span className="text-right">Acciones</span>,
        cell: ({ row }) => {
          const category = row.original;
          return (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openEditDialog(category)}
                aria-label={`Editar ${category.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => openDeleteDialog(category)}
                aria-label={`Eliminar ${category.name}`}
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

  return (
    <>
      <div
        className="sticky top-20 z-20 mb-4 flex justify-end bg-background/95 py-2 backdrop-blur supports-backdrop-filter:bg-background/80"
        aria-label="Acciones de categorías"
      >
        <Button onClick={() => setCreateDialogOpen(true)}>
          Agregar categoría
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
          ) : categories.length === 0 ? (
            <EmptyState message="No se encontraron categorías" />
          ) : (
            <DataTable
              data={categories}
              columns={columns}
              filterColumn="name"
              filterPlaceholder="Filtrar por nombre..."
              emptyMessage="No se encontraron categorías."
            />
          )}
        </CardContent>
      </Card>

      <CategoryForm
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          setFormError(null);
        }}
        onSubmit={handleCreate}
        mode="create"
        error={formError && createDialogOpen ? formError : null}
      />

      {selectedCategory && (
        <>
          <CategoryForm
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              setSelectedCategory(null);
              setFormError(null);
            }}
            onSubmit={handleEdit}
            mode="edit"
            defaultValues={{
              name: selectedCategory.name,
              description: selectedCategory.description || '',
            }}
            error={formError && editDialogOpen ? formError : null}
          />

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) {
                setSelectedCategory(null);
                setError(null);
              }
            }}
            onConfirm={handleDelete}
            title="Eliminar categoría"
            description="¿Estás seguro de querer eliminar esta categoría? Esta acción no puede deshacerse."
            itemName={selectedCategory.name}
          />
        </>
      )}
    </>
  );
}
