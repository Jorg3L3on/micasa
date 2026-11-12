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
import type { IncomeTemplateListItem, WalletListItem } from '@/types/catalog';

export default async function IncomeTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<OwnerSearchParams>;
}) {
  const ownerContext = ownerContextFromSearchParams(await searchParams);
  let rows: ScheduledRowModel[] = [];
  let loadFailed = false;
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

  return (
    <ScheduledList
      kind="income"
      rows={rows}
      createLabel={PAGE_CREATE_ACTION.incomeTemplate.label}
      loadFailed={loadFailed}
    />
  );
}
