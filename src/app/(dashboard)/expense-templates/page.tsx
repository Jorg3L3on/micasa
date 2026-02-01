'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
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
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { clientFetchFromApi, deleteExpenseTemplate } from '@/lib/api';
import { Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { ExpenseTemplateListItem } from '@/types/catalog';

export default function ExpenseTemplatesPage() {
  const router = useRouter();
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
      );
      setTemplates(templatesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!selectedTemplate) return;
    try {
      setError(null);
      await deleteExpenseTemplate(selectedTemplate.id);
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
    router.push(`/expense-templates/${template.id}/edit`);
  };

  const openDeleteDialog = (template: ExpenseTemplateListItem) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
    setError(null);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={() => router.push('/expense-templates/new')}>
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
                  <TableHead>Primera quincena</TableHead>
                  <TableHead>Segunda quincena</TableHead>
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
                      {formatCurrency(template.totalEstimatedAmount ?? 0)}
                    </TableCell>
                    <TableCell>{template.cutoffDay}</TableCell>
                    <TableCell>{template.dueDay}</TableCell>

                    <TableCell>{template.isRecurring ? 'Sí' : 'No'}</TableCell>
                    <TableCell>
                      {template.appliesFirstFortnight ? 'Sí' : 'No'}
                    </TableCell>
                    <TableCell>
                      {template.appliesSecondFortnight ? 'Sí' : 'No'}
                    </TableCell>
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
          description="¿Estás seguro de querer eliminar esta plantilla de gastos? Esta acción no puede ser deshecha."
          itemName={selectedTemplate.name}
        />
      )}
    </>
  );
}
