import { PaymentMethodType } from '@/generated/prisma/client';
import type { ReportSummaryResult } from '@/lib/finance/report-summary.service';
import type { WalletListItem } from '@/types/catalog';

export type FundingWalletBreakdownRow =
  ReportSummaryResult['fundingWalletBreakdown'][number];

/** Derive liquidity funding wallets from the panel wallet list (wave 1). */
export const buildFundingWalletBreakdownFromWallets = (
  wallets: WalletListItem[],
): FundingWalletBreakdownRow[] =>
  wallets
    .filter(
      (w) =>
        w.active &&
        w.include_in_liquidity &&
        (w.type === PaymentMethodType.CASH ||
          w.type === PaymentMethodType.DEBIT_CARD),
    )
    .map((w) => ({
      id: w.id,
      name: w.name,
      amount: w.amount,
      type: w.type as PaymentMethodType,
      provider_icon_key: w.provider_icon_key,
    }))
    .sort(
      (a, b) =>
        a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'es'),
    );
