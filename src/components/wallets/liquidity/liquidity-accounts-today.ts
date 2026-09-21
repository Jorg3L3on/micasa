import { getCardRiskLabel } from '@/components/wallets/liquidity/liquidity-personalization';
import {
  isCreditOrStoreCardWalletType,
  PAYMENT_METHOD_LABELS,
} from '@/domain/payment-method';
import {
  inferLenderProviderIconKey,
  isFonacotLenderName,
} from '@/lib/finance/lender-identity';
import type { WalletListItem } from '@/types/catalog';
import type { LoanListItem } from '@/types/loans';

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

export type AccountTodayRiskTone = 'emerald' | 'amber' | 'destructive' | 'muted';

export type AccountTodayBadge = {
  label: string;
  tone: AccountTodayRiskTone;
};

export type AccountTodayWalletRow = {
  kind: 'wallet';
  wallet: WalletListItem;
};

export type AccountTodayLoanRow = {
  kind: 'loan';
  loan: LoanListItem;
};

export type AccountTodayRow = AccountTodayWalletRow | AccountTodayLoanRow;

export type AccountTodayView = {
  key: string;
  kind: 'wallet' | 'loan';
  name: string;
  typeLabel: string;
  providerIconKey: string | null;
  isFonacot: boolean;
  figures: AccountLiveFigures;
  badge: AccountTodayBadge | null;
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

export const getLoanLiveFigures = (
  loan: Pick<LoanListItem, 'remainingAmount' | 'totalPayable' | 'principalAmount'>,
): AccountLiveFigures => {
  const remaining = Math.max(0, Number(loan.remainingAmount) || 0);
  const total =
    Math.max(0, Number(loan.totalPayable) || 0) ||
    Math.max(0, Number(loan.principalAmount) || 0);

  if (total <= 0) {
    return {
      isCredit: true,
      debt: remaining,
      free: null,
      utilizationPct: null,
      isUnrated: true,
    };
  }

  return {
    isCredit: true,
    debt: remaining,
    free: null,
    utilizationPct: Math.min(100, (remaining / total) * 100),
    isUnrated: false,
  };
};

export const loanTypeLabel = (type: LoanListItem['type']): string =>
  type === 'PAYROLL' ? 'Préstamo de nómina' : 'Préstamo personal';

const cuotaLabel = (remainingPayments: number): string =>
  remainingPayments === 1 ? '1 cuota' : `${remainingPayments} cuotas`;

export const getLoanProgressLabel = (
  remainingPayments: number,
  utilizationPct: number | null,
): AccountTodayBadge => {
  if (remainingPayments <= 0) return { label: 'Saldo pendiente', tone: 'muted' };
  const label = cuotaLabel(remainingPayments);
  if (utilizationPct == null) return { label, tone: 'muted' };
  if (utilizationPct > 80) return { label, tone: 'destructive' };
  if (utilizationPct > 50) return { label, tone: 'amber' };
  return { label, tone: 'emerald' };
};

export const isActiveLoanToday = (loan: LoanListItem): boolean =>
  loan.status === 'ACTIVE' && Math.max(0, Number(loan.remainingAmount) || 0) > 0;

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

export const sortLoansToday = (loans: LoanListItem[]): LoanListItem[] =>
  [...loans]
    .filter(isActiveLoanToday)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

export const buildAccountsToday = (
  wallets: WalletListItem[],
  loans: LoanListItem[],
): AccountTodayRow[] => [
  ...sortAccountsToday(wallets).map((wallet) => ({ kind: 'wallet' as const, wallet })),
  ...sortLoansToday(loans).map((loan) => ({ kind: 'loan' as const, loan })),
];

const resolveWalletProviderIconKey = (wallet: WalletListItem): string | null => {
  const fromNameOrStored = inferLenderProviderIconKey(
    wallet.name,
    wallet.provider_icon_key,
  );
  if (fromNameOrStored) return fromNameOrStored;
  if (wallet.type === 'CASH') return 'CASH_GENERIC';
  return null;
};

export const toAccountTodayView = (row: AccountTodayRow): AccountTodayView => {
  if (row.kind === 'wallet') {
    const figures = getAccountLiveFigures(row.wallet);
    return {
      key: `wallet-${row.wallet.id}`,
      kind: 'wallet',
      name: row.wallet.name,
      typeLabel:
        PAYMENT_METHOD_LABELS[row.wallet.type as keyof typeof PAYMENT_METHOD_LABELS] ??
        row.wallet.type,
      providerIconKey: resolveWalletProviderIconKey(row.wallet),
      isFonacot: false,
      figures,
      badge: figures.isCredit
        ? getCardRiskLabel(figures.utilizationPct, figures.isUnrated)
        : null,
    };
  }

  const figures = getLoanLiveFigures(row.loan);
  const remainingPayments = Math.max(0, Number(row.loan.remainingPayments) || 0);

  return {
    key: `loan-${row.loan.id}`,
    kind: 'loan',
    name: row.loan.name,
    typeLabel: loanTypeLabel(row.loan.type),
    providerIconKey: inferLenderProviderIconKey(row.loan.lender),
    isFonacot: isFonacotLenderName(row.loan.lender),
    figures,
    badge: getLoanProgressLabel(remainingPayments, figures.utilizationPct),
  };
};
