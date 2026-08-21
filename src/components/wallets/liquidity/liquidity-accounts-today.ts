import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import type { WalletListItem } from '@/types/catalog';

const ACCOUNT_TYPES = ['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'DEPARTMENT_STORE_CARD'] as const;

type AccountLiveInput = {
  type: string;
  amount: number;
  credit_limit?: number | null;
  temporary_credit_limit?: number | null;
};

export type AccountLiveFigures = {
  isCredit: boolean;
  debt: number | null;
  free: number | null;
  utilizationPct: number | null;
  isUnrated: boolean;
};

const getEffectiveCreditLimit = ({
  credit_limit,
  temporary_credit_limit,
}: {
  credit_limit: number | null | undefined;
  temporary_credit_limit: number | null | undefined;
}): number | null => {
  if (credit_limit == null && temporary_credit_limit == null) return null;
  if (credit_limit == null) return temporary_credit_limit ?? null;
  if (temporary_credit_limit == null) return credit_limit ?? null;
  return Math.max(credit_limit, temporary_credit_limit);
};

export const getAccountLiveFigures = (account: AccountLiveInput): AccountLiveFigures => {
  const isCredit = isCreditOrStoreCardWalletType(account.type);
  const used = Math.max(0, Number(account.amount) || 0);
  if (!isCredit) {
    return {
      isCredit: false,
      debt: null,
      free: used,
      utilizationPct: null,
      isUnrated: false,
    };
  }

  const limit = getEffectiveCreditLimit({
    credit_limit: account.credit_limit,
    temporary_credit_limit: account.temporary_credit_limit,
  });
  if (limit == null || limit <= 0) {
    return {
      isCredit: true,
      debt: used,
      free: null,
      utilizationPct: null,
      isUnrated: true,
    };
  }

  return {
    isCredit: true,
    debt: used,
    free: Math.max(0, limit - used),
    utilizationPct: Math.min(100, (used / limit) * 100),
    isUnrated: false,
  };
};

export const sortAccountsToday = (wallets: WalletListItem[]): WalletListItem[] =>
  [...wallets]
    .filter(
      (wallet) =>
        ACCOUNT_TYPES.includes(wallet.type as (typeof ACCOUNT_TYPES)[number]) &&
        wallet.active,
    )
    .sort((a, b) => {
      const rank = (type: string) => {
        if (type === 'CASH') return 0;
        if (type === 'DEBIT_CARD') return 1;
        if (type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD') return 2;
        return 3;
      };
      const rankDiff = rank(a.type) - rank(b.type);
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name, 'es');
    });
