import { todayCalendarDate } from '@/lib/calendar-dates';
import { listWalletsByOwner } from '@/lib/finance/wallet.service';
import { listWalletMovements } from '@/lib/finance/wallet-movements';
import {
  buildWalletBalanceMetrics,
  metricsMovementsFromDate,
  type WalletBalanceMetrics,
} from '@/lib/finance/wallet-balance-evolution';
import type { OwnerFilter } from '@/lib/server/get-owner-context';

export type WalletMetricsResponse = {
  months: number;
  by_wallet_id: Record<string, WalletBalanceMetrics>;
};

const DEFAULT_MONTHS = 6;
const MAX_MONTHS = 24;

export const parseMetricsMonths = (raw: string | null): number => {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_MONTHS;
  return Math.min(Math.max(parsed, 1), MAX_MONTHS);
};

export async function listWalletMetricsByOwner(
  ownerFilter: OwnerFilter,
  months = DEFAULT_MONTHS,
): Promise<WalletMetricsResponse> {
  const today = todayCalendarDate();
  const from = metricsMovementsFromDate(months, today);
  const wallets = await listWalletsByOwner(ownerFilter);

  const by_wallet_id: Record<string, WalletBalanceMetrics> = {};

  await Promise.all(
    wallets.map(async (wallet) => {
      const movements = await listWalletMovements(
        wallet.id,
        ownerFilter,
        from,
        today,
      );
      by_wallet_id[String(wallet.id)] = buildWalletBalanceMetrics(
        Number(wallet.amount),
        movements,
        wallet.type,
        months,
        today,
      );
    }),
  );

  return { months, by_wallet_id };
}
