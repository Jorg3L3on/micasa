import {
  getCachedWalletCardVtSnapshot,
  type WalletCardVtSnapshot,
} from '@/lib/ui/wallet-card-view-transition';
import {
  getWalletListCache,
  walletListOwnerKey,
} from '@/lib/ui/wallet-list-cache';
import type { FinanceContextType } from '@/types/finance-context';
import type { CreditCardListItem, WalletListItem } from '@/types/catalog';
import type { WalletDetail } from '@/types/wallet-movements';
import { PAYMENT_METHOD_LABELS } from '@/domain/payment-method';
import type { PaymentMethodType } from '@/domain/payment-method';

const typeFromLabel = (typeLabel: string, isCredit: boolean): string => {
  const entry = (
    Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethodType, string][]
  ).find(([, label]) => label === typeLabel);
  if (entry) return entry[0];
  return isCredit ? 'CREDIT_CARD' : 'DEBIT_CARD';
};

const walletListItemToDetail = (item: WalletListItem): WalletDetail => ({
  id: item.id,
  name: item.name,
  provider_icon_key: item.provider_icon_key,
  type: item.type,
  amount: Number(item.amount) || 0,
  credit_limit: item.credit_limit ?? null,
  temporary_credit_limit: item.temporary_credit_limit ?? null,
  active: item.active,
  include_in_liquidity: item.include_in_liquidity,
  cutoff_day: item.cutoff_day ?? null,
  due_day: item.due_day ?? null,
  minimum_payment: item.minimum_payment ?? null,
  apr_annual: item.apr_annual ?? null,
  cat_annual: item.cat_annual ?? null,
  goal_amount: item.goal_amount ?? null,
  goal_due_date: item.goal_due_date ?? null,
  created_at: null,
  assignee_user_id: item.assignee?.id ?? null,
});

const snapshotToWalletDetail = (
  snapshot: WalletCardVtSnapshot,
): WalletDetail => ({
  id: snapshot.id,
  name: snapshot.name,
  provider_icon_key: snapshot.providerIconKey,
  type: typeFromLabel(snapshot.typeLabel, snapshot.isCredit),
  amount: snapshot.amount,
  credit_limit: snapshot.creditLimit ?? null,
  temporary_credit_limit: null,
  active: true,
  include_in_liquidity: true,
  cutoff_day: null,
  due_day: null,
  minimum_payment: null,
  apr_annual: null,
  cat_annual: null,
  goal_amount: null,
  goal_due_date: null,
  created_at: null,
  assignee_user_id: null,
});

const walletListItemToCreditCard = (
  item: WalletListItem,
): CreditCardListItem | null => {
  if (item.type !== 'CREDIT_CARD' && item.type !== 'DEPARTMENT_STORE_CARD') {
    return null;
  }
  return {
    ...item,
    amount: Number(item.amount) || 0,
    available_credit:
      item.credit_limit != null
        ? Number(item.credit_limit) - (Number(item.amount) || 0)
        : null,
  };
};

const snapshotToCreditCard = (
  snapshot: WalletCardVtSnapshot,
): CreditCardListItem => {
  const type = typeFromLabel(snapshot.typeLabel, true);
  return {
    id: snapshot.id,
    name: snapshot.name,
    provider_icon_key: snapshot.providerIconKey as WalletListItem['provider_icon_key'],
    amount: snapshot.amount,
    credit_limit: snapshot.creditLimit ?? null,
    temporary_credit_limit: null,
    type,
    active: true,
    include_in_liquidity: true,
    cutoff_day: null,
    due_day: null,
    minimum_payment: null,
    apr_annual: null,
    cat_annual: null,
    spent_amount: snapshot.amount,
    remaining_amount: snapshot.availableCredit ?? 0,
    assignee_user_id: null,
    assignee: null,
    available_credit: snapshot.availableCredit ?? null,
  };
};

const findInListCache = (
  context: FinanceContextType | null | undefined,
  walletId: number,
): WalletListItem | null => {
  const key = walletListOwnerKey(context);
  if (!key) return null;
  const list = getWalletListCache(key);
  if (!list) return null;
  return list.find((w) => w.id === walletId) ?? null;
};

/** Instant funding-detail hero seed from list cache or VT stash (list → detail). */
export const seedWalletDetail = (
  walletId: number,
  context: FinanceContextType | null | undefined,
): WalletDetail | null => {
  if (!Number.isFinite(walletId)) return null;
  const fromList = findInListCache(context, walletId);
  if (fromList && fromList.type !== 'GOAL') {
    return walletListItemToDetail(fromList);
  }
  const snapshot = getCachedWalletCardVtSnapshot(walletId);
  if (!snapshot || snapshot.isCredit) return null;
  return snapshotToWalletDetail(snapshot);
};

/** Instant credit-detail card seed from list cache or VT stash. */
export const seedCreditCardDetail = (
  cardId: number,
  context: FinanceContextType | null | undefined,
): CreditCardListItem | null => {
  if (!Number.isFinite(cardId)) return null;
  const fromList = findInListCache(context, cardId);
  if (fromList) {
    return walletListItemToCreditCard(fromList);
  }
  const snapshot = getCachedWalletCardVtSnapshot(cardId);
  if (!snapshot?.isCredit) return null;
  return snapshotToCreditCard(snapshot);
};

export const hasWalletVtStash = (walletId: number): boolean =>
  getCachedWalletCardVtSnapshot(walletId) != null;
