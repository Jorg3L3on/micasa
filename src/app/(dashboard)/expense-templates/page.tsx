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
import PageHeader from '@/components/PageHeader';
import ExpenseTemplateForm, {
  ExpenseTemplateFormValues,
} from '@/components/ExpenseTemplateForm';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  clientFetchFromApi,
  createExpenseTemplate,
  updateExpenseTemplate,
  deleteExpenseTemplate,
} from '@/lib/api';
import { Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type ExpenseTemplate = {
  id: number;
  name: string;
  category: string;
  suggestedAmount: number | null;
  paymentMethod: string | null;
  active: boolean;
  totalEstimatedAmount: number;
  dueDay: number | null;
  cutoffDay: number | null;
  isRecurring: boolean;
  appliesFirstFortnight: boolean;
  appliesSecondFortnight: boolean;
  isSubscription: boolean;
};

type Category = {
  id: number;
  name: string;
};

type PaymentMethod = {
  id: number;
  name: string;
};

export default function ExpenseTemplatesPage() {
  const [templates, setTemplates] = useState<ExpenseTemplate[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ExpenseTemplate | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [templatesData, categoriesData, paymentMethodsData] =
        await Promise.all([
          clientFetchFromApi<ExpenseTemplate[]>('/api/expense-templates'),
          clientFetchFromApi<Category[]>('/api/categories'),
          clientFetchFromApi<PaymentMethod[]>('/api/payment-methods'),
        ]);
      setTemplates(templatesData);
      setCategories(categoriesData);
      setPaymentMethods(paymentMethodsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async (data: ExpenseTemplateFormValues) => {
    try {
      setFormError(null);
      await createExpenseTemplate(data);
      await fetchData();
      setCreateDialogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to create expense template';
      setFormError(message);
      throw err;
    }
  };

  const handleEdit = async (data: ExpenseTemplateFormValues) => {
    if (!selectedTemplate) return;
    try {
      setFormError(null);
      await updateExpenseTemplate(selectedTemplate.id, data);
      await fetchData();
      setEditDialogOpen(false);
      setSelectedTemplate(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to update expense template';
      setFormError(message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    try {
      setError(null);
      await deleteExpenseTemplate(selectedTemplate.id);
      await fetchData();
      setDeleteDialogOpen(false);
      setSelectedTemplate(null);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to delete expense template';
      if (
        message.includes('409') ||
        message.includes('in use') ||
        message.includes('Conflict')
      ) {
        setError('Expense template is in use and cannot be deleted');
      } else {
        setError(message);
      }
    }
  };

  const openEditDialog = (template: ExpenseTemplate) => {
    setSelectedTemplate(template);
    setEditDialogOpen(true);
    setFormError(null);
  };

  const openDeleteDialog = (template: ExpenseTemplate) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
    setError(null);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <PageHeader title="Plantillas de gastos" />
        <Button onClick={() => setCreateDialogOpen(true)}>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Total estimado</TableHead>
                  <TableHead>Día de corte</TableHead>
                  <TableHead>Día de pago</TableHead>
                  <TableHead>Recurrente</TableHead>
                  <TableHead>Es una suscripción</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      {template.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {template.category}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(template.totalEstimatedAmount)}
                    </TableCell>
                    <TableCell>{template.cutoffDay}</TableCell>
                    <TableCell>{template.dueDay}</TableCell>
                    <TableCell>{template.isRecurring ? 'Sí' : 'No'}</TableCell>
                    <TableCell>
                      {template.isSubscription ? 'Sí' : 'No'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          template.active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}
                      >
                        {template.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(template)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(template)}
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

      <ExpenseTemplateForm
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

      {selectedTemplate && (
        <>
          <ExpenseTemplateForm
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              setSelectedTemplate(null);
              setFormError(null);
            }}
            onSubmit={handleEdit}
            mode="edit"
            defaultValues={{
              name: selectedTemplate.name,
              categoryId:
                categories.find((c) => c.name === selectedTemplate.category)
                  ?.id || 0,
              suggestedAmount: selectedTemplate.suggestedAmount ?? null,
              paymentMethodId:
                paymentMethods.find(
                  (pm) => pm.name === selectedTemplate.paymentMethod,
                )?.id || null,
              active: selectedTemplate.active,
              dueDay: 1,
              cutoffDay: 1,
              isRecurring: false,
              appliesFirstFortnight: false,
              appliesSecondFortnight: false,
              isSubscription: false,
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
                setSelectedTemplate(null);
                setError(null);
              }
            }}
            onConfirm={handleDelete}
            title="Eliminar plantilla de gastos"
            description="¿Estás seguro de querer eliminar esta plantilla de gastos? Esta acción no puede ser deshecha."
            itemName={selectedTemplate.name}
          />
        </>
      )}
    </>
  );
}
