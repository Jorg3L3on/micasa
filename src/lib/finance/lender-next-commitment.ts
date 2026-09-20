import type { LenderPayWindowView } from '@/types/lenders';
import type { LoanListItem } from '@/types/loans';

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

export type LenderNextCommitmentKind = 'wallet' | 'payroll' | 'scheduled' | 'none';

export type LenderNextCommitment = {
  kind: LenderNextCommitmentKind;
  amount: number;
  date: string | null;
  dateEnd: string | null;
  isRange: boolean;
};

type PayWindowInput = Pick<
  LenderPayWindowView,
  'amount' | 'commitmentDate' | 'commitmentDateEnd' | 'isRange' | 'canPay'
>;

type LoanNextInput = Pick<LoanListItem, 'status' | 'paymentSource' | 'nextPayment'>;

/** Display next due for a prestamista group. Wallet Pagar window wins; otherwise active nextPayment. */
export const lenderNextCommitment = (
  payWindow: PayWindowInput,
  loans: readonly LoanNextInput[],
): LenderNextCommitment => {
  if (payWindow.canPay) {
    return {
      kind: 'wallet',
      amount: payWindow.amount,
      date: payWindow.commitmentDate,
      dateEnd: payWindow.commitmentDateEnd,
      isRange: payWindow.isRange,
    };
  }

  const nextPayments = loans
    .filter((loan) => loan.status === 'ACTIVE' && loan.nextPayment)
    .map((loan) => ({
      payment: loan.nextPayment!,
      paymentSource: loan.paymentSource,
    }));

  if (nextPayments.length === 0) {
    return {
      kind: 'none',
      amount: 0,
      date: null,
      dateEnd: null,
      isRange: false,
    };
  }

  const dates = nextPayments
    .map((row) => row.payment.dueDate)
    .sort((a, b) => a.localeCompare(b));
  const date = dates[0]!;
  const dateEnd = dates[dates.length - 1]!;
  const payrollOnly = nextPayments.every(
    (row) => row.paymentSource === 'PAYROLL_DEDUCTION',
  );

  return {
    kind: payrollOnly ? 'payroll' : 'scheduled',
    amount: roundMoney(
      nextPayments.reduce((sum, row) => sum + row.payment.amount, 0),
    ),
    date,
    dateEnd,
    isRange: date !== dateEnd,
  };
};
