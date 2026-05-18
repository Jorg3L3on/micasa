export type LoanTypeValue = 'PERSONAL' | 'PAYROLL';
export type LoanPaymentFrequencyValue = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
export type LoanPaymentSourceValue = 'WALLET' | 'PAYROLL_DEDUCTION';
export type LoanStatusValue = 'ACTIVE' | 'PAID_OFF' | 'PAUSED' | 'CANCELLED';
export type LoanPaymentStatusValue =
  | 'SCHEDULED'
  | 'PAID'
  | 'SKIPPED'
  | 'CANCELLED';

export type LoanPaymentListItem = {
  id: number;
  loanId: number;
  sequence: number;
  dueDate: string;
  amount: number;
  status: LoanPaymentStatusValue;
  paidAt: string | null;
  sourceWalletId: number | null;
  sourceWalletName: string | null;
  note: string | null;
};

export type LoanListItem = {
  id: number;
  name: string;
  lender: string;
  type: LoanTypeValue;
  status: LoanStatusValue;
  principalAmount: number;
  paymentAmount: number;
  paymentCount: number;
  frequency: LoanPaymentFrequencyValue;
  startDate: string;
  paymentSource: LoanPaymentSourceValue;
  sourceWalletId: number | null;
  sourceWalletName: string | null;
  linkedWalletId: number | null;
  linkedWalletName: string | null;
  incomeTemplateId: number | null;
  incomeTemplateName: string | null;
  notes: string | null;
  paidAmount: number;
  remainingAmount: number;
  paidPayments: number;
  remainingPayments: number;
  nextPayment: LoanPaymentListItem | null;
  payments?: LoanPaymentListItem[];
};

export type LoanDuePaymentItem = LoanPaymentListItem & {
  loanName: string;
  lender: string;
  loanType: LoanTypeValue;
  paymentSource: LoanPaymentSourceValue;
  linkedWalletId: number | null;
  linkedWalletName: string | null;
  incomeTemplateName: string | null;
};

export type PlannerLoanPaymentsResponse = {
  first: LoanDuePaymentItem[];
  second: LoanDuePaymentItem[];
};
