import { Suspense } from 'react';
import { fetchFromApi } from '@/lib/api-server';
import { Card, CardContent } from '@/components/ui/card';
import EmptyState from '@/components/EmptyState';
import TransactionFilters from '@/components/TransactionFilters';
import TransactionsDataTable from '@/components/TransactionsDataTable';
import type { TransactionRow } from '@/types/catalog';

async function getTransactions(searchParams: {
  month?: string;
  year?: string;
  type?: string;
  ownerType?: string;
  ownerId?: string;
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
    const ownerContext =
      searchParams.ownerType && searchParams.ownerId
        ? {
            ownerType: searchParams.ownerType as 'user' | 'house',
            ownerId: Number(searchParams.ownerId),
          }
        : undefined;
    return await fetchFromApi<TransactionRow[]>(endpoint, ownerContext);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

async function TransactionsContent({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    year?: string;
    type?: string;
    ownerType?: string;
    ownerId?: string;
  }>;
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
            <TransactionsDataTable transactions={transactions} />
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    year?: string;
    type?: string;
    ownerType?: string;
    ownerId?: string;
  }>;
}) {
  return (
    <>
      <Suspense fallback={<div>Cargando transacciones...</div>}>
        <TransactionsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
