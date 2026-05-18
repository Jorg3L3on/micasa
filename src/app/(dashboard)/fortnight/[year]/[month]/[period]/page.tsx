import { fetchFromApi, type OwnerContext } from '@/lib/api-server';
import FortnightHeader from '@/components/FortnightHeader';
import ExpenseTable from '@/components/ExpenseTable';
import SummaryBlock from '@/components/SummaryBlock';
import EmptyState from '@/components/EmptyState';
import { ReceivePayrollTrigger } from '@/components/ReceivePayrollButton';
import type {
  PlannerCardChargesSummary,
  PlannerCardStatementDueSummary,
  PlannerOrphanCardPaymentsSummary,
  ReportsSummaryFundingFields,
  TransactionRow,
} from '@/types/catalog';

type Summary = {
  totalIncome: number;
  totalExpense: number;
  totalPaid: number;
  totalUnpaid: number;
  balance: number;
  userIncome?: Array<{
    fortnightId: number;
    userIncome: Array<{ userId: number; userName: string; income: number }>;
  }>;
  planningExpenseCount?: number;
  planningPaidExpenseCount?: number;
  planningUnpaidExpenseCount?: number;
  cardCharges?: PlannerCardChargesSummary | null;
  planningOrphanCardPayments?: PlannerOrphanCardPaymentsSummary | null;
  planningCardStatementDue?: PlannerCardStatementDueSummary | null;
} & ReportsSummaryFundingFields;

function groupTransactionsByDate(
  transactions: TransactionRow[],
): Record<string, TransactionRow[]> {
  return transactions.reduce(
    (acc, transaction) => {
      const date = new Date(transaction.date).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(transaction);
      return acc;
    },
    {} as Record<string, TransactionRow[]>,
  );
}

async function getFortnightInfo(
  year: string,
  month: string,
  period: string,
  ownerContext?: OwnerContext,
): Promise<{ label: string; id: number | null }> {
  try {
    const response = await fetchFromApi<{ id: number; label: string } | null>(
      `/api/fortnights?year=${year}&month=${month}&period=${period}`,
      ownerContext,
    );
    if (!response) return { label: `${month}/${year} - ${period}`, id: null };
    return { label: response.label, id: response.id };
  } catch (error) {
    console.error('Error fetching fortnight info:', error);
    return { label: `${month}/${year} - ${period}`, id: null };
  }
}

async function getTransactions(
  year: string,
  month: string,
  period: string,
  ownerContext?: OwnerContext,
): Promise<TransactionRow[]> {
  try {
    return await fetchFromApi<TransactionRow[]>(
      `/api/transactions?year=${year}&month=${month}&period=${period}&type=expense&exclude_credit_installment=true`,
      ownerContext,
    );
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

async function getSummary(
  year: string,
  month: string,
  period: string,
  ownerContext?: OwnerContext,
): Promise<Summary> {
  try {
    return await fetchFromApi<Summary>(
      `/api/reports?type=summary&year=${year}&month=${month}&period=${period}&exclude_credit_installment=true`,
      ownerContext,
    );
  } catch (error) {
    console.error('Error fetching summary:', error);
    return {
      totalIncome: 0,
      totalExpense: 0,
      totalPaid: 0,
      totalUnpaid: 0,
      balance: 0,
      fundingWalletBalanceTotal: 0,
      fundingNetVsPendingExpense: 0,
      fundingWalletBreakdown: [],
    };
  }
}

export default async function FortnightPage({
  params,
  searchParams,
}: {
  params: Promise<{ year: string; month: string; period: string }>;
  searchParams: Promise<{ ownerType?: string; ownerId?: string }>;
}) {
  const {
    year: yearParam,
    month: monthParam,
    period: periodParam,
  } = await params;
  const resolvedSearchParams = await searchParams;
  const ownerContext: OwnerContext | undefined =
    resolvedSearchParams.ownerType && resolvedSearchParams.ownerId
      ? {
          ownerType: resolvedSearchParams.ownerType as 'user' | 'house',
          ownerId: Number(resolvedSearchParams.ownerId),
        }
      : undefined;

  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);
  const period = periodParam.toUpperCase() as 'FIRST' | 'SECOND';

  const [fortnightInfo, transactions, summary] = await Promise.all([
    getFortnightInfo(yearParam, monthParam, periodParam, ownerContext),
    getTransactions(yearParam, monthParam, periodParam, ownerContext),
    getSummary(yearParam, monthParam, periodParam, ownerContext),
  ]);
  const fortnightLabel = fortnightInfo.label;
  const fortnightId = fortnightInfo.id;

  const transactionsByDate = groupTransactionsByDate(transactions);
  const sortedDates = Object.keys(transactionsByDate).sort();

  const tenemos = summary.totalIncome;
  const libre = summary.balance;
  const pagado = summary.totalPaid;
  const pendiente = summary.totalUnpaid;

  return (
    <>
      <FortnightHeader
        year={year}
        month={month}
        period={period}
        label={fortnightLabel}
        actions={
          fortnightId != null ? (
            <ReceivePayrollTrigger
              fortnightId={fortnightId}
              period={period}
              year={year}
              month={month}
            />
          ) : null
        }
      />

      <div className="space-y-5">
        {/* TOP SECTION - Summary Cards */}
        <SummaryBlock
          tenemos={tenemos}
          libre={libre}
          pagado={pagado}
          pendiente={pendiente}
          year={year}
          month={month}
          period={period}
          expenseCount={summary.planningExpenseCount ?? transactions.length}
          paidExpenseCount={
            summary.planningPaidExpenseCount ??
            transactions.filter((t) => t.is_paid).length
          }
          unpaidExpenseCount={
            summary.planningUnpaidExpenseCount ??
            transactions.filter((t) => !t.is_paid).length
          }
          cardCharges={summary.cardCharges ?? null}
          planningOrphanCardPayments={
            summary.planningOrphanCardPayments ?? null
          }
          planningCardStatementDue={summary.planningCardStatementDue ?? null}
          fundingWalletBalanceTotal={summary.fundingWalletBalanceTotal}
          fundingNetVsPendingExpense={summary.fundingNetVsPendingExpense}
          fundingWalletBreakdown={summary.fundingWalletBreakdown}
        />

        {/* BOTTOM SECTION - Expense Tables */}
        <div className="space-y-6">
          {sortedDates.length === 0 ? (
            <EmptyState message="No hay transacciones para esta quincena" />
          ) : (
            sortedDates.map((date) => (
              <ExpenseTable
                key={date}
                date={date}
                expenses={transactionsByDate[date]}
                totalIncome={tenemos}
                year={year}
                month={month}
                period={period}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
