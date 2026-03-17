import { Suspense } from 'react';
import { fetchFromApi } from '@/lib/api-server';
import { Skeleton } from '@/components/ui/skeleton';
import TransactionsDataTable from '@/components/TransactionsDataTable';
import type { TransactionRow } from '@/types/catalog';

type TransactionSearchParams = {
  month?: string;
  year?: string;
  period?: string;
  type?: string;
  ownerType?: string;
  ownerId?: string;
};

async function getTransactions(
  searchParams: TransactionSearchParams,
): Promise<TransactionRow[]> {
  try {
    const params = new URLSearchParams();
    if (searchParams.month) params.append('month', searchParams.month);
    if (searchParams.year) params.append('year', searchParams.year);
    if (searchParams.period) params.append('period', searchParams.period);
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

function TransactionsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[500px] rounded-xl" />
    </div>
  );
}

async function TransactionsContent({
  searchParams,
}: {
  searchParams: Promise<TransactionSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const transactions = await getTransactions(resolvedSearchParams);
  return <TransactionsDataTable transactions={transactions} />;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<TransactionSearchParams>;
}) {
  return (
    <Suspense fallback={<TransactionsLoadingSkeleton />}>
      <TransactionsContent searchParams={searchParams} />
    </Suspense>
  );
}
