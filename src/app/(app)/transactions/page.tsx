import { Suspense } from 'react';
import { fetchFromApi } from '@/lib/api-server';
import { CollectionTableSkeleton } from '@/components/loading/page-skeletons';
import TransactionsDataTable from '@/components/TransactionsDataTable';
import {
  ContentEnter,
  SkeletonExit,
} from '@/components/view-transition/SuspenseReveal';
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
    <SkeletonExit>
      <CollectionTableSkeleton />
    </SkeletonExit>
  );
}

async function TransactionsContent({
  searchParams,
}: {
  searchParams: Promise<TransactionSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const transactions = await getTransactions(resolvedSearchParams);
  return (
    <ContentEnter>
      <TransactionsDataTable transactions={transactions} />
    </ContentEnter>
  );
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
