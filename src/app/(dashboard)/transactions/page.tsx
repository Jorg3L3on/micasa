import { Suspense } from 'react';
import { fetchFromApi } from '@/lib/api-server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import TransactionFilters from '@/components/TransactionFilters';
import { formatDate, formatCurrencySigned } from '@/lib/utils';
import type { TransactionRow } from '@/types/catalog';

async function getTransactions(searchParams: {
  month?: string;
  year?: string;
  type?: string;
}): Promise<TransactionRow[]> {
  try {
    const params = new URLSearchParams();
    if (searchParams.month) params.append('month', searchParams.month);
    if (searchParams.year) params.append('year', searchParams.year);
    if (searchParams.type) params.append('type', searchParams.type);

    params.append('is_paid', 'true');

    const endpoint = `/api/transactions${
      params.toString() ? `?${params.toString()}` : ''
    }`;
    return await fetchFromApi<TransactionRow[]>(endpoint);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

async function TransactionsContent({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; type?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const transactions = await getTransactions(resolvedSearchParams);

  return (
    <>
      <Suspense fallback={<div>Cargando filtros...</div>}>
        <TransactionFilters />
      </Suspense>

      <Card>
        <CardContent className="pt-6">
          {transactions.length === 0 ? (
            <EmptyState message="No se encontraron transacciones" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Método de pago</TableHead>
                  <TableHead>Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(transaction.date)}
                    </TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-medium ${
                          transaction.type === 'expense'
                            ? 'text-destructive'
                            : 'text-chart-4'
                        }`}
                      >
                        {formatCurrencySigned(
                          transaction.amount,
                          transaction.type ?? 'expense',
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {transaction.category}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {transaction.paymentMethod}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          transaction.type === 'expense'
                            ? 'destructive'
                            : 'default'
                        }
                      >
                        {transaction.type === 'expense' ? 'Gasto' : 'Ingreso'}
                      </Badge>
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

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; type?: string }>;
}) {
  return (
    <>
      <Suspense fallback={<div>Cargando transacciones...</div>}>
        <TransactionsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
