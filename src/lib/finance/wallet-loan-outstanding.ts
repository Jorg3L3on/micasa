import { listLoansByOwner } from '@/lib/finance/loan.service';
import type { OwnerFilter } from '@/lib/server/get-owner-context';
import type { LoanListItem } from '@/types/loans';

type LoanOutstandingInput = Pick<
  LoanListItem,
  'status' | 'sourceWalletId' | 'linkedWalletId' | 'remainingAmount'
>;

/**
 * What active loans still owe, per wallet. A loan counts for the wallet it is
 * linked to and for the wallet it is paid from, once per wallet. The amount is
 * the loan's unpaid remainder (scheduled payments not yet paid).
 */
export const sumLoanOutstandingByWallet = (
  loans: LoanOutstandingInput[],
): Map<number, number> => {
  const totals = new Map<number, number>();
  for (const loan of loans) {
    if (loan.status !== 'ACTIVE') continue;
    const remaining = Math.max(0, Number(loan.remainingAmount) || 0);
    if (remaining === 0) continue;
    const walletIds = new Set(
      [loan.sourceWalletId, loan.linkedWalletId].filter(
        (id): id is number => id != null,
      ),
    );
    for (const walletId of walletIds) {
      totals.set(walletId, (totals.get(walletId) ?? 0) + remaining);
    }
  }
  return totals;
};

export const loadLoanOutstandingByWallet = async (
  ownerFilter: OwnerFilter,
): Promise<Map<number, number>> =>
  sumLoanOutstandingByWallet(await listLoansByOwner(ownerFilter));
