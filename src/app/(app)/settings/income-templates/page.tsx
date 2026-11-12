import { fetchFromApi } from '@/lib/api-server';
import { PAGE_CREATE_ACTION } from '@/lib/ui/page-create-action';
import { ScheduledList } from '@/components/scheduled/ScheduledList';
import {
  ownerContextFromSearchParams,
  type OwnerSearchParams,
} from '@/components/scheduled/owner-context';
import {
  incomeRows,
  type ScheduledRowModel,
} from '@/components/scheduled/scheduled-rows';
import {
  fromExpenseTemplate,
  summarize,
  type ScheduledSummary,
} from '@/lib/ui/scheduled-items';
import type {
  ExpenseTemplateListItem,
  IncomeTemplateListItem,
  WalletListItem,
} from '@/types/catalog';

export default async function IncomeTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<OwnerSearchParams>;
}) {
  const ownerContext = ownerContextFromSearchParams(await searchParams);
  let rows: ScheduledRowModel[] = [];
  let loadFailed = false;
  // "Queda tras gastos" needs the same owner's gastos programados. If they do
  // not load, the cell is left out instead of netting against nothing.
  const expenseSummaryPromise: Promise<ScheduledSummary | null> = fetchFromApi<
    ExpenseTemplateListItem[]
  >('/api/expense-templates', ownerContext)
    .then((items) => summarize(items.map(fromExpenseTemplate)))
    .catch((error) => {
      console.error('Error fetching gastos programados for the net line:', error);
      return null;
    });
  try {
    // The income list carries only `walletId`; the wallet list names it.
    const [items, wallets] = await Promise.all([
      fetchFromApi<IncomeTemplateListItem[]>('/api/income-templates', ownerContext),
      fetchFromApi<WalletListItem[]>('/api/wallets', ownerContext),
    ]);
    rows = incomeRows(items, wallets);
  } catch (error) {
    console.error('Error fetching ingresos programados:', error);
    loadFailed = true;
  }

  const expenseSummary = await expenseSummaryPromise;

  return (
    <ScheduledList
      kind="income"
      rows={rows}
      createLabel={PAGE_CREATE_ACTION.incomeTemplate.label}
      loadFailed={loadFailed}
      expenseSummary={expenseSummary}
    />
  );
}
