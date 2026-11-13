import { fetchFromApi } from '@/lib/api-server';
import { PAGE_CREATE_ACTION } from '@/lib/ui/page-create-action';
import { ScheduledList } from '@/components/scheduled/ScheduledList';
import {
  ownerContextFromSearchParams,
  type OwnerSearchParams,
} from '@/components/scheduled/owner-context';
import {
  expenseRows,
  type ScheduledRowModel,
} from '@/components/scheduled/scheduled-rows';
import type { ExpenseTemplateListItem } from '@/types/catalog';

export default async function ExpenseTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<OwnerSearchParams>;
}) {
  const ownerContext = ownerContextFromSearchParams(await searchParams);
  let rows: ScheduledRowModel[] = [];
  let loadFailed = false;
  try {
    const items = await fetchFromApi<ExpenseTemplateListItem[]>(
      '/api/expense-templates',
      ownerContext,
    );
    rows = expenseRows(items);
  } catch (error) {
    console.error('Error fetching gastos programados:', error);
    loadFailed = true;
  }

  return (
    <ScheduledList
      kind="expense"
      rows={rows}
      createLabel={PAGE_CREATE_ACTION.expenseTemplate.label}
      loadFailed={loadFailed}
    />
  );
}
