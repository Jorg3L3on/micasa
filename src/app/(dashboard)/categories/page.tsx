'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import CategoryForm from '@/components/CategoryForm';
import { CategoryFormValues } from '@/schemas/category.schema';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  clientFetchFromApi,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/lib/api';
import { Pencil, Trash2 } from 'lucide-react';
import type { CategoryOption } from '@/types/catalog';

export default function CategoriesPage() {
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
  }, []);

  const handleCreate = async (data: CategoryFormValues) => {
    try {
      setFormError(null);
      await createCategory(data);
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
      await updateCategory(selectedCategory.id, data);
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
      await deleteCategory(selectedCategory.id);
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

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell className="font-medium">
                      {category.name}
                    </TableCell>
                    <TableCell>{category.description}</TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
