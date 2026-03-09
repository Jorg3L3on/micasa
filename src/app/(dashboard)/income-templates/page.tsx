'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi, deleteIncomeTemplate } from '@/lib/api';
import { Pencil, Trash2 } from 'lucide-react';
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

  const fetchData = async () => {
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
  };

  useEffect(() => {
    fetchData();
  }, [context]);

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

  const handleEdit = (template: IncomeTemplateListItem) => {
    router.push(`/income-templates/${template.id}/edit${queryString ? `?${queryString}` : ''}`);
  };

  const openDeleteDialog = (template: IncomeTemplateListItem) => {
    setSelectedTemplate(template);
    setDeleteDialogOpen(true);
    setError(null);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={() => router.push(`/income-templates/new${queryString ? `?${queryString}` : ''}`)}>
          Agregar plantilla de ingresos
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
            <EmptyState message="No se encontraron plantillas de ingresos" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Monto sugerido</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Primera quincena</TableHead>
                  <TableHead>Segunda quincena</TableHead>
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
                    <TableCell className="text-right font-medium">
                      {template.suggestedAmount != null
                        ? formatCurrency(template.suggestedAmount)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {template.source ?? '—'}
                    </TableCell>
                    <TableCell>
                      {template.appliesFirstFortnight ? 'Sí' : 'No'}
                    </TableCell>
                    <TableCell>
                      {template.appliesSecondFortnight ? 'Sí' : 'No'}
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
          title="Eliminar plantilla de ingresos"
          description="¿Estás seguro de querer eliminar esta plantilla de ingresos? Esta acción no puede deshacerse."
          itemName={selectedTemplate.name}
        />
      )}
    </>
  );
}
