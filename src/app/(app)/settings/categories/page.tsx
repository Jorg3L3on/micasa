'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Eye, EyeOff, Plus } from 'lucide-react';
import type { CategoryOption } from '@/types/catalog';
import { CategoryTreeRow } from '@/components/categories/CategoryTreeRow';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useRegisterToolbarActions,
  type ToolbarOverflowItem,
} from '@/context/toolbar-actions-context';
import { cn } from '@/lib/utils';

export default function CategoriesPage() {
  const { context } = useFinanceContext();
  const isMobile = useIsMobile();
  const [kindTab, setKindTab] = useState<'expense' | 'income'>('expense');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [openSwipeId, setOpenSwipeId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] =
    useState<CategoryOption | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const isIncomeTab = kindTab === 'income';
  const kindNoun = isIncomeTab ? 'ingresos' : 'gastos';

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientFetchFromApi<CategoryOption[]>(
        `/api/categories?kind=${kindTab}`,
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
  }, [context, kindTab]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    setCreateDialogOpen(false);
    setEditDialogOpen(false);
    setDeleteDialogOpen(false);
    setSelectedCategory(null);
    setFormError(null);
    setOpenSwipeId(null);
    setError(null);
  }, [kindTab]);

  useEffect(() => {
    if (!isMobile) setOpenSwipeId(null);
  }, [isMobile]);

  const rootOptions = useMemo(
    () =>
      categories.filter((c) => c.parentId == null && (c.active ?? true)),
    [categories],
  );

  const tree = useMemo(() => {
    const visible = showInactive
      ? categories
      : categories.filter((c) => c.active ?? true);
    const roots = visible
      .filter((c) => c.parentId == null)
      .sort(
        (a, b) =>
          (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
          a.name.localeCompare(b.name, 'es'),
      );
    return roots.map((root) => ({
      root,
      children: visible
        .filter((c) => c.parentId === root.id)
        .sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            a.name.localeCompare(b.name, 'es'),
        ),
    }));
  }, [categories, showInactive]);

  const visibleCount = useMemo(
    () => tree.reduce((n, g) => n + 1 + g.children.length, 0),
    [tree],
  );

  const handleCreate = async (data: CategoryFormValues) => {
    try {
      setFormError(null);
      await createCategory(
        {
          name: data.name,
          description: data.description,
          icon: data.icon,
          parentId: data.parentId ?? null,
          kind: isIncomeTab ? 'INCOME' : 'EXPENSE',
        },
        context,
      );
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
      await updateCategory(
        selectedCategory.id,
        {
          name: data.name,
          description: data.description,
          icon: data.icon,
        },
        context,
      );
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

  const handleToggleActive = async (category: CategoryOption) => {
    const nextActive = !(category.active ?? true);
    try {
      setError(null);
      await updateCategory(category.id, { active: nextActive }, context);
      toast.success(
        nextActive
          ? 'Categoría activada'
          : `Categoría desactivada (ya no aparece al asignar ${kindNoun})`,
      );
      await fetchCategories();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo cambiar el estado de la categoría',
      );
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
      setError(message);
      setDeleteDialogOpen(false);
    }
  };

  const openEdit = (category: CategoryOption) => {
    setSelectedCategory(category);
    setEditDialogOpen(true);
    setFormError(null);
    setOpenSwipeId(null);
  };

  const openDelete = (category: CategoryOption) => {
    setSelectedCategory(category);
    setDeleteDialogOpen(true);
    setError(null);
    setOpenSwipeId(null);
  };

  const openCreate = useCallback(() => {
    setFormError(null);
    setCreateDialogOpen(true);
  }, []);

  const handleToggleShowInactive = useCallback(() => {
    setShowInactive((value) => !value);
  }, []);

  const primaryActionIcon = useMemo(
    () => <Plus data-icon="inline-start" />,
    [],
  );

  const overflowItems = useMemo<ToolbarOverflowItem[]>(
    () => [
      {
        key: 'toggle-inactive',
        label: showInactive ? 'Ocultar inactivas' : 'Mostrar inactivas',
        onClick: handleToggleShowInactive,
        icon: showInactive ? (
          <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
        ) : (
          <Eye className="h-4 w-4 shrink-0" aria-hidden />
        ),
      },
    ],
    [showInactive, handleToggleShowInactive],
  );

  useRegisterToolbarActions({
    primaryAction: {
      label: 'Nueva categoría',
      onClick: openCreate,
      icon: primaryActionIcon,
    },
    overflow: { items: overflowItems },
  });

  return (
    <>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs
            value={kindTab}
            onValueChange={(value) => {
              if (value === 'expense' || value === 'income') {
                setKindTab(value);
              }
            }}
            className="w-full max-w-[22rem] gap-0"
          >
            <TabsList
              variant="segmented"
              aria-label="Tipo de categoría"
              className="w-full touch-manipulation"
            >
              <TabsTrigger value="expense">Gastos</TabsTrigger>
              <TabsTrigger value="income">Ingresos</TabsTrigger>
            </TabsList>
          </Tabs>
          {!loading && visibleCount > 0 ? (
            <p className="text-xs text-muted-foreground">
              {visibleCount} visibles
              {showInactive ? ' · incluye inactivas' : null}
            </p>
          ) : null}
        </div>

        {error && !deleteDialogOpen ? (
          <div
            className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <Card className="overflow-hidden border-border/60">
          <CardContent className="py-3 sm:py-4">
            {loading ? (
              <div className="space-y-2" aria-busy="true" aria-label="Cargando categorías">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className={cn('h-11 w-full rounded-lg', i % 3 !== 0 && 'ml-6 w-[calc(100%-1.5rem)]')}
                  />
                ))}
              </div>
            ) : tree.length === 0 ? (
              <EmptyState
                message={
                  showInactive
                    ? 'No hay categorías para mostrar'
                    : 'Aún no tienes categorías'
                }
                description={
                  showInactive
                    ? 'Prueba mostrar las inactivas o agrega una nueva.'
                    : `Se crean por defecto al registrar; puedes agregar padres o subcategorías de ${kindNoun}.`
                }
                action={{
                  label: 'Nueva categoría',
                  onClick: openCreate,
                }}
              />
            ) : (
              <ul className="space-y-3" role="list">
                {tree.map(({ root, children }) => (
                  <li key={root.id} className="space-y-1" role="listitem">
                    <CategoryTreeRow
                      category={root}
                      isChild={false}
                      swipeEnabled={isMobile}
                      isSwipeOpen={openSwipeId === root.id}
                      onSwipeOpenChange={(open) =>
                        setOpenSwipeId(open ? root.id : null)
                      }
                      onEdit={() => openEdit(root)}
                      onToggleActive={() => void handleToggleActive(root)}
                      onRequestDelete={() => openDelete(root)}
                    />
                    {children.length > 0 ? (
                      <ul
                        className="ml-3 space-y-0.5 border-l border-border/60 pl-3"
                        role="list"
                        aria-label={`Subcategorías de ${root.name}`}
                      >
                        {children.map((child) => (
                          <li key={child.id} role="listitem">
                            <CategoryTreeRow
                              category={child}
                              isChild
                              swipeEnabled={isMobile}
                              isSwipeOpen={openSwipeId === child.id}
                              onSwipeOpenChange={(open) =>
                                setOpenSwipeId(open ? child.id : null)
                              }
                              onEdit={() => openEdit(child)}
                              onToggleActive={() =>
                                void handleToggleActive(child)
                              }
                              onRequestDelete={() => openDelete(child)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {isMobile && tree.length > 0 ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Desliza una categoría a la izquierda para eliminarla.
          </p>
        ) : null}
      </div>

      <CategoryForm
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          setFormError(null);
        }}
        onSave={handleCreate}
        mode="create"
        parentOptions={rootOptions}
        error={formError && createDialogOpen ? formError : null}
      />

      {selectedCategory ? (
        <>
          <CategoryForm
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              if (!open) setSelectedCategory(null);
              setFormError(null);
            }}
            onSave={handleEdit}
            mode="edit"
            defaultValues={{
              name: selectedCategory.name,
              description: selectedCategory.description || '',
              icon: selectedCategory.icon || '',
              parentId: selectedCategory.parentId ?? null,
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
            description={
              isIncomeTab
                ? 'Solo se puede eliminar si no tiene subcategorías, ingresos ni plantillas. Si solo quieres ocultarla al asignar, usa Desactivar.'
                : 'Solo se puede eliminar si no tiene subcategorías, gastos, plantillas ni presupuestos. Si solo quieres ocultarla al asignar, usa Desactivar.'
            }
            itemName={selectedCategory.name}
          />
        </>
      ) : null}
    </>
  );
}
