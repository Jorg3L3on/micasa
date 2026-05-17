import type { ExpenseWalletType } from '@/types/catalog';

export type ExpenseFeedItem = {
  id: number;
  description: string;
  amount: number;
  date: string;
  category: string | null;
  categoryIcon: string | null;
  paymentMethod: string | null;
  walletType: ExpenseWalletType | null;
  isPaid: boolean;
  isRecurring: boolean;
  creditInstallmentCurrent: number | null;
  creditInstallmentTotal: number | null;
  categoryId: number | null;
  walletId: number | null;
};

export type ExpensesRecentResponse = {
  items: ExpenseFeedItem[];
  nextCursor: string | null;
};
