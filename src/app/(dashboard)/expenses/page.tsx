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
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import ExpenseForm from '@/components/ExpenseForm';
import { ExpenseFormValues } from '@/schemas/expense.schema';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  clientFetchFromApi,
  createExpense,
  updateExpense,
  deleteExpense,
} from '@/lib/api';
import { Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type {
  ExpenseListItem,
  CategoryOption,
  PaymentMethodOption,
} from '@/types/catalog';

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseListItem | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [expensesData, categoriesData, paymentMethodsData] =
        await Promise.all([
          clientFetchFromApi<ExpenseListItem[]>('/api/expenses'),
          clientFetchFromApi<CategoryOption[]>('/api/categories'),
          clientFetchFromApi<PaymentMethodOption[]>('/api/payment-methods'),
        ]);
      setExpenses(expensesData);
      setCategories(categoriesData);
      setPaymentMethods(paymentMethodsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (data: ExpenseFormValues) => {
    try {
      setFormError(null);
      await createExpense(data);
      toast.success('Gasto creado');
      await fetchData();
      setCreateDialogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error al crear el gasto';
      setFormError(message);
      throw err;
    }
  };

  const getErrorMessage = (err: unknown): string => {
    if (!(err instanceof Error)) {
      return 'Error al actualizar el gasto';
    }

    // Check if error has details (validation errors)
    const errorWithDetails = err as any;
    if (
      errorWithDetails.details &&
      Array.isArray(errorWithDetails.details) &&
      errorWithDetails.details.length > 0
    ) {
      // Map field names to Spanish
      const fieldNames: Record<string, string> = {
        name: 'Nombre',
        categoryId: 'Categoría',
        defaultAmount: 'Monto por defecto',
        paymentMethodId: 'Método de pago',
        active: 'Activo',
      };

      // Format validation errors
      const messages = errorWithDetails.details.map((issue: any) => {
        const fieldName =
          fieldNames[issue.path?.[0]] || issue.path?.[0] || 'Campo';
        let message = issue.message || '';

        // Translate common validation messages
        if (message.includes('Required') || message.includes('required')) {
          message = 'es requerido';
        } else if (message.includes('Expected')) {
          message = 'tiene un formato inválido';
        } else if (message.includes('positive')) {
          message = 'debe ser un número positivo';
        } else if (message.includes('int')) {
          message = 'debe ser un número entero';
        } else if (message.includes('Invalid')) {
          message = 'tiene un valor inválido';
        }

        return `${fieldName} ${message}`;
      });

      return messages.join('. ');
    }

    // Check for specific error messages and translate them
    const errorMessage = err.message;
    if (errorMessage.includes('Validation error')) {
      return 'Por favor, verifica los campos del formulario';
    }
    if (errorMessage.includes('not found')) {
      return 'El gasto no fue encontrado';
    }
    if (errorMessage.includes('Failed to update')) {
      return 'Error al actualizar el gasto';
    }

    return errorMessage || 'Error al actualizar el gasto';
  };

  const handleEdit = async (data: ExpenseFormValues) => {
    if (!selectedExpense) return;
    try {
      setFormError(null);

      // Build update data - always include name and active, only include other fields if valid
      const updateData: {
        name?: string;
        categoryId?: number;
        defaultAmount?: number | null;
        paymentMethodId?: number;
        active?: boolean;
      } = {
        name: data.name,
        active: data.active,
      };

      // Only include categoryId if it's a valid positive number
      if (data.categoryId && data.categoryId > 0) {
        updateData.categoryId = data.categoryId;
      }

      // Only include paymentMethodId if it's a valid positive number
      if (data.paymentMethodId && data.paymentMethodId > 0) {
        updateData.paymentMethodId = data.paymentMethodId;
      }

      // Include defaultAmount (can be null)
      updateData.defaultAmount = data.defaultAmount ?? null;

      await updateExpense(selectedExpense.id, updateData);
      toast.success('Gasto actualizado');
      await fetchData();
      setEditDialogOpen(false);
      setSelectedExpense(null);
    } catch (err) {
      const message = getErrorMessage(err);
      setFormError(message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!selectedExpense) return;
    try {
      setError(null);
      await deleteExpense(selectedExpense.id);
      toast.success('Gasto eliminado');
      await fetchData();
      setDeleteDialogOpen(false);
      setSelectedExpense(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete expense';
      if (
        message.includes('409') ||
        message.includes('in use') ||
        message.includes('Conflict')
      ) {
        setError('El gasto está en uso y no puede eliminarse');
      } else {
        setError(message);
      }
    }
  };

  const openEditDialog = (expense: ExpenseListItem) => {
    setSelectedExpense(expense);
    setEditDialogOpen(true);
    setFormError(null);
  };

  const openDeleteDialog = (expense: ExpenseListItem) => {
    setSelectedExpense(expense);
    setDeleteDialogOpen(true);
    setError(null);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={() => setCreateDialogOpen(true)}>Agregar gasto</Button>
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
          ) : expenses.length === 0 ? (
            <EmptyState message="No se encontraron gastos" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Monto por defecto</TableHead>
                  <TableHead>Método de pago</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium">
                      {expense.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.category}
                    </TableCell>
                    <TableCell className="text-right">
                      {expense.defaultAmount
                        ? formatCurrency(expense.defaultAmount)
                        : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {expense.paymentMethod}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={expense.active ? 'default' : 'secondary'}
                      >
                        {expense.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(expense)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(expense)}
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

      <ExpenseForm
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          setFormError(null);
        }}
        onSubmit={handleCreate}
        mode="create"
        error={formError && createDialogOpen ? formError : null}
        categories={categories}
        paymentMethods={paymentMethods}
      />

      {selectedExpense && (
        <>
          <ExpenseForm
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              setSelectedExpense(null);
              setFormError(null);
            }}
            onSubmit={handleEdit}
            mode="edit"
            defaultValues={{
              name: selectedExpense.name,
              categoryId: selectedExpense.categoryId || 0,
              defaultAmount: selectedExpense.defaultAmount,
              paymentMethodId: selectedExpense.paymentMethodId,
              active: selectedExpense.active,
            }}
            error={formError && editDialogOpen ? formError : null}
            categories={categories}
            paymentMethods={paymentMethods}
          />

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) {
                setSelectedExpense(null);
                setError(null);
              }
            }}
            onConfirm={handleDelete}
            title="Eliminar gasto"
            description="¿Estás seguro de querer eliminar este gasto? Esta acción no puede ser deshecha."
            itemName={selectedExpense.name}
          />
        </>
      )}
    </>
  );
}
