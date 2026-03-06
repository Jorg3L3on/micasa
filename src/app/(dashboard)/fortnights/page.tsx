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
import EmptyState from '@/components/EmptyState';
import {
  clientFetchFromApi,
} from '@/lib/api';
import { formatMonth, formatYear, formatPeriod } from '@/lib/utils';
import type { FortnightListItem } from '@/types/catalog';

export default function FortnightsPage() {
  const [fortnights, setFortnights] = useState<FortnightListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFortnights = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clientFetchFromApi<FortnightListItem[]>(
        '/api/fortnights',
      );
      setFortnights(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar las quincenas',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFortnights();
  }, []);

  return (
    <>
      {error && (
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
                    <TableCell>{formatMonth(fortnight.month ?? 0)}</TableCell>
                    <TableCell>{formatYear(fortnight.year ?? 0)}</TableCell>
                    <TableCell>
                      {formatPeriod(fortnight.period ?? 'FIRST')}
                    </TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
