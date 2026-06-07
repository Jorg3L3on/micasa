import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';

type LoanStatInput = Pick<
  DashboardData,
  'planningWalletLoanDue' | 'planningPayrollLoanDeduction'
>;

/** Headline + subtitle for the dashboard Préstamos stat (split wallet vs nómina). */
export const getDashboardLoanStatDisplay = (data: LoanStatInput) => {
  const walletTotal = data.planningWalletLoanDue?.total ?? 0;
  const walletCount = data.planningWalletLoanDue?.count ?? 0;
  const payrollTotal = data.planningPayrollLoanDeduction?.total ?? 0;
  const payrollCount = data.planningPayrollLoanDeduction?.count ?? 0;

  const amount = walletTotal + payrollTotal;

  let subtitle: string;
  if (walletTotal > 0 && payrollTotal > 0) {
    subtitle = `${formatCurrency(walletTotal)} billetera · ${formatCurrency(payrollTotal)} nómina`;
  } else if (payrollTotal > 0) {
    subtitle = `${payrollCount} deducción${payrollCount !== 1 ? 'es' : ''} nómina`;
  } else if (walletTotal > 0) {
    subtitle = `${walletCount} pendiente${walletCount !== 1 ? 's' : ''} billetera`;
  } else {
    subtitle = 'Sin cuotas en el periodo';
  }

  return { amount, subtitle };
};
