'use client';

import { useState, useEffect } from 'react';
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

type Category = {
  id: number;
  name: string;
  description: string;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientFetchFromApi<Category[]>('/api/categories');
      setCategories(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch categories',
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
      await fetchCategories();
      setCreateDialogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create category';
      setFormError(message);
      throw err;
    }
  };

  const handleEdit = async (data: CategoryFormValues) => {
    if (!selectedCategory) return;
    try {
      setFormError(null);
      await updateCategory(selectedCategory.id, data);
      await fetchCategories();
      setEditDialogOpen(false);
      setSelectedCategory(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update category';
      setFormError(message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    try {
      setError(null);
      await deleteCategory(selectedCategory.id);
      await fetchCategories();
      setDeleteDialogOpen(false);
      setSelectedCategory(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete category';
      if (
        message.includes('409') ||
        message.includes('in use') ||
        message.includes('Conflict')
      ) {
        setError('Category is in use and cannot be deleted');
      } else {
        setError(message);
      }
    }
  };

  const openEditDialog = (category: Category) => {
    setSelectedCategory(category);
    setEditDialogOpen(true);
    setFormError(null);
  };

  const openDeleteDialog = (category: Category) => {
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
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(category)}
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
            description="¿Estás seguro de querer eliminar esta categoría? Esta acción no puede ser deshecha."
            itemName={selectedCategory.name}
          />
        </>
      )}
    </>
  );
}
