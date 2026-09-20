import type { LoanListItem, LoanPaymentListItem } from '@/types/loans';

export type LenderPaymentModeValue = 'WALLET' | 'EXTERNAL';

export type LenderPayWindowItem = {
  id: number;
  loanId: number;
  loanName: string;
  sequence: number;
  dueDate: string;
  amount: number;
};

export type LenderPayWindowView = {
  amount: number;
  commitmentDate: string | null;
  commitmentDateEnd: string | null;
  isRange: boolean;
  canPay: boolean;
  included: LenderPayWindowItem[];
};

export type LenderPaymentListItem = {
  id: number;
  lenderId: number;
  amount: number;
  paidAt: string;
  mode: LenderPaymentModeValue;
  sourceWalletId: number | null;
  sourceWalletName: string | null;
  expenseId: number | null;
  note: string | null;
  installmentCount: number;
};

export type LenderListItem = {
  id: number;
  name: string;
  providerIconKey: string | null;
  notes: string | null;
  active: boolean;
  remainingPrincipal: number;
  activeContractCount: number;
  payrollOnly: boolean;
  payWindow: LenderPayWindowView;
  loans: LoanListItem[];
  recentPayments?: LenderPaymentListItem[];
};

export type LenderDetail = LenderListItem & {
  payments: LenderPaymentListItem[];
};

export type PayLenderResult = {
  lender: LenderDetail;
  payment: LenderPaymentListItem;
  loanPayments: LoanPaymentListItem[];
};
