import { fetchFromApi } from '@/lib/api-server';
import ExpensesFeed from '@/components/expenses/ExpensesFeed';
import type { ExpensesRecentResponse } from '@/types/expenses-feed';

const PAGE_SIZE = 25;

type SearchParams = {
  ownerType?: string;
  ownerId?: string;
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const ownerContext =
    params.ownerType && params.ownerId
      ? {
          ownerType: params.ownerType as 'user' | 'house',
          ownerId: Number(params.ownerId),
        }
      : undefined;

  let initialPage: ExpensesRecentResponse;
  try {
    initialPage = await fetchFromApi<ExpensesRecentResponse>(
      `/api/expenses/recent?limit=${PAGE_SIZE}`,
      ownerContext,
    );
  } catch {
    initialPage = { items: [], nextCursor: null };
  }

  return <ExpensesFeed initialPage={initialPage} />;
}
