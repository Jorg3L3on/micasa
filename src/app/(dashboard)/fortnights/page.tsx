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
import FortnightForm, { FortnightFormValues } from '@/components/FortnightForm';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import {
  clientFetchFromApi,
  createFortnight,
  updateFortnight,
  deleteFortnight,
} from '@/lib/api';
import { Pencil, Trash2 } from 'lucide-react';
import { formatMonth, formatYear, formatPeriod } from '@/lib/utils';

type Fortnight = {
  id: number;
  name: string;
  startDay: number;
  endDay: number;
  active: boolean;
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
};

export default function FortnightsPage() {
  const [fortnights, setFortnights] = useState<Fortnight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFortnight, setSelectedFortnight] = useState<Fortnight | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const fetchFortnights = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientFetchFromApi<Fortnight[]>('/api/fortnights');
      setFortnights(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch fortnights',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFortnights();
  }, []);

  const handleCreate = async (data: FortnightFormValues) => {
    try {
      setFormError(null);
      await createFortnight(data);
      await fetchFortnights();
      setCreateDialogOpen(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create fortnight';
      setFormError(message);
      throw err;
    }
  };

  const handleEdit = async (data: FortnightFormValues) => {
    if (!selectedFortnight) return;
    try {
      setFormError(null);
      await updateFortnight(selectedFortnight.id, data);
      await fetchFortnights();
      setEditDialogOpen(false);
      setSelectedFortnight(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to update fortnight';
      setFormError(message);
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!selectedFortnight) return;
    try {
      setError(null);
      await deleteFortnight(selectedFortnight.id);
      await fetchFortnights();
      setDeleteDialogOpen(false);
      setSelectedFortnight(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete fortnight';
      if (
        message.includes('409') ||
        message.includes('in use') ||
        message.includes('Conflict')
      ) {
        setError('Fortnight is in use and cannot be deleted');
      } else {
        setError(message);
      }
    }
  };

  const openEditDialog = (fortnight: Fortnight) => {
    setSelectedFortnight(fortnight);
    setEditDialogOpen(true);
    setFormError(null);
  };

  const openDeleteDialog = (fortnight: Fortnight) => {
    setSelectedFortnight(fortnight);
    setDeleteDialogOpen(true);
    setError(null);
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <Button onClick={() => setCreateDialogOpen(true)}>
          Agregar quincena
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
          ) : fortnights.length === 0 ? (
            <EmptyState message="No se encontraron quincenas" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Mes</TableHead>
                  <TableHead>Año</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fortnights.map((fortnight) => (
                  <TableRow key={fortnight.id}>
                    <TableCell className="font-medium">
                      {fortnight.name}
                    </TableCell>
                    <TableCell>{fortnight.startDay}</TableCell>
                    <TableCell>{fortnight.endDay}</TableCell>
                    <TableCell>{formatMonth(fortnight.month)}</TableCell>
                    <TableCell>{formatYear(fortnight.year)}</TableCell>
                    <TableCell>{formatPeriod(fortnight.period)}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          fortnight.active
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                        }`}
                      >
                        {fortnight.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(fortnight)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(fortnight)}
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

      <FortnightForm
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          setFormError(null);
        }}
        onSubmit={handleCreate}
        mode="create"
        error={formError && createDialogOpen ? formError : null}
      />

      {selectedFortnight && (
        <>
          <FortnightForm
            open={editDialogOpen}
            onOpenChange={(open) => {
              setEditDialogOpen(open);
              setSelectedFortnight(null);
              setFormError(null);
            }}
            onSubmit={handleEdit}
            mode="edit"
            defaultValues={{
              name: selectedFortnight.name,
              startDay: selectedFortnight.startDay,
              endDay: selectedFortnight.endDay,
              active: selectedFortnight.active,
              month: selectedFortnight.month,
              year: selectedFortnight.year,
              period: selectedFortnight.period,
            }}
            error={formError && editDialogOpen ? formError : null}
          />

          <ConfirmDeleteDialog
            open={deleteDialogOpen}
            onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) {
                setSelectedFortnight(null);
                setError(null);
              }
            }}
            onConfirm={handleDelete}
            title="Eliminar quincena"
            description="¿Estás seguro de querer eliminar esta quincena? Esta acción no puede ser deshecha."
            itemName={selectedFortnight.name}
          />
        </>
      )}
    </>
  );
}
