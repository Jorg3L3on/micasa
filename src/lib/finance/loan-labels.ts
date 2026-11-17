import { formatMonthYear } from '@/lib/calendar-dates';
import { formatInstallmentLabel } from '@/lib/finance/loan-schedule';
import type { LoanPaymentSourceValue } from '@/types/loans';

/**
 * Where the installment is paid from: the income template for payroll loans
 * ("Salario Carmen", fallback "Nómina"), the source wallet otherwise.
 */
export const getLoanSourceLabel = (input: {
  paymentSource: LoanPaymentSourceValue;
  sourceWalletName?: string | null;
  incomeTemplateName?: string | null;
}): string | null => {
  if (input.paymentSource === 'PAYROLL_DEDUCTION') {
    return input.incomeTemplateName?.trim() || 'Nómina';
  }
  return input.sourceWalletName?.trim() || null;
};

/**
 * "Salario Carmen · cuota 19 de 24 · termina jun 2027". Parts without data
 * are left out; never "19/24" alone.
 */
export const formatLoanInstallmentCaption = (input: {
  source?: string | null;
  sequence?: number | null;
  paymentCount?: number | null;
  endDate?: string | Date | null;
}): string => {
  const parts: string[] = [];
  if (input.source) parts.push(input.source);
  if (input.sequence && input.paymentCount) {
    parts.push(
      formatInstallmentLabel(input.sequence, input.paymentCount, {
        lowercase: true,
      }),
    );
  }
  if (input.endDate) parts.push(`termina ${formatMonthYear(input.endDate)}`);
  return parts.join(' · ');
};
