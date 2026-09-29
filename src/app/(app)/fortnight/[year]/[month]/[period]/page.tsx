import { formatCalendarDate } from '@/lib/calendar-dates';
import { fetchFromApi, type OwnerContext } from '@/lib/api-server';
import FortnightHeader from '@/components/FortnightHeader';
import ExpenseTable from '@/components/ExpenseTable';
import SummaryBlock from '@/components/SummaryBlock';
import EmptyState from '@/components/EmptyState';
import { ErrorBanner } from '@/components/error-banner';
import { ReceivePayrollTrigger } from '@/components/ReceivePayrollButton';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatFortnightOrdinalTitle } from '@/lib/fortnight-calendar';
import { parseFortnightPeriod } from '@/lib/finance/report-helpers';
import type {
  PlannerCardChargesSummary,
  PlannerCardStatementDueSummary,
  PlannerOrphanCardPaymentsSummary,
  PlannerPayrollLoanDeductionSummary,
  PlannerWalletLoanDueSummary,
  ReportsSummaryFundingFields,
  TransactionRow,
  WalletListItem,
} from '@/types/catalog';
import { filterFortnightExpenseTabRows } from '@/lib/finance/fortnight-expense-tab';
import { getPendingLiquidityLineItems } from '@/lib/finance/pending-liquidity-items';

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
  planningWalletLoanDue?: PlannerWalletLoanDueSummary | null;
  planningPayrollLoanDeduction?: PlannerPayrollLoanDeductionSummary | null;
} & ReportsSummaryFundingFields;

function groupTransactionsByDate(
  transactions: TransactionRow[],
): Record<string, TransactionRow[]> {
  return transactions.reduce(
    (acc, transaction) => {
      const date = formatCalendarDate(new Date(transaction.date));
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
): Promise<{ rows: TransactionRow[]; failed: boolean }> {
  try {
    const rows = await fetchFromApi<TransactionRow[]>(
      `/api/transactions?year=${year}&month=${month}&period=${period}&type=expense&exclude_credit_installment=true`,
      ownerContext,
    );
    return { rows, failed: false };
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return { rows: [], failed: true };
  }
}

const emptySummary = (): Summary => ({
  totalIncome: 0,
  totalExpense: 0,
  totalPaid: 0,
  totalUnpaid: 0,
  balance: 0,
  fundingWalletBalanceTotal: 0,
  fundingNetVsPendingExpense: 0,
  fundingWalletBreakdown: [],
});

async function getSummary(
  year: string,
  month: string,
  period: string,
  ownerContext?: OwnerContext,
): Promise<{ summary: Summary; failed: boolean }> {
  try {
    const summary = await fetchFromApi<Summary>(
      `/api/reports?type=summary&year=${year}&month=${month}&period=${period}&exclude_credit_installment=true`,
      ownerContext,
    );
    return { summary, failed: false };
  } catch (error) {
    console.error('Error fetching summary:', error);
    return { summary: emptySummary(), failed: true };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string; month: string; period: string }>;
}): Promise<Metadata> {
  const {
    year: yearParam,
    month: monthParam,
    period: periodParam,
  } = await params;
  const year = Number.parseInt(yearParam, 10);
  const month = Number.parseInt(monthParam, 10);
  const period = periodParam.toUpperCase();
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    (period !== 'FIRST' && period !== 'SECOND')
  ) {
    return { title: 'Quincena' };
  }

  return {
    title: formatFortnightOrdinalTitle(period, month, year),
  };
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
  const period = parseFortnightPeriod(periodParam);
  if (!period || !Number.isFinite(year) || !Number.isFinite(month)) {
    notFound();
  }
  if (periodParam !== period) {
    const qs = new URLSearchParams();
    if (resolvedSearchParams.ownerType) {
      qs.set('ownerType', resolvedSearchParams.ownerType);
    }
    if (resolvedSearchParams.ownerId) {
      qs.set('ownerId', resolvedSearchParams.ownerId);
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    redirect(
      `/fortnight/${yearParam}/${monthParam}/${period}${suffix}`,
    );
  }

  const [fortnightInfo, transactionResult, summaryResult, wallets] = await Promise.all([
    getFortnightInfo(yearParam, monthParam, periodParam, ownerContext),
    getTransactions(yearParam, monthParam, periodParam, ownerContext),
    getSummary(yearParam, monthParam, periodParam, ownerContext),
    fetchFromApi<WalletListItem[]>('/api/wallets', ownerContext).catch(() => []),
  ]);
  const transactions = transactionResult.rows;
  const expenseListRows = filterFortnightExpenseTabRows(transactions);
  const summary = summaryResult.summary;
  const movementsFailed = transactionResult.failed || summaryResult.failed;
  const fortnightId = fortnightInfo.id;

  const transactionsByDate = groupTransactionsByDate(expenseListRows);
  const sortedDates = Object.keys(transactionsByDate).sort();

  const tenemos = summary.totalIncome;
  const libre = summary.balance;
  const pagado = summary.totalPaid;
  const pendiente = summary.totalUnpaid;

  return (
    <div className="space-y-5">
      <FortnightHeader
        year={year}
        month={month}
        period={period}
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

      {movementsFailed ? (
        <ErrorBanner>
          No se pudieron cargar los gastos de esta quincena.
        </ErrorBanner>
      ) : (
      <>
      {/* TOP SECTION - Summary Cards */}
      <SummaryBlock
        tenemos={tenemos}
        libre={libre}
        pagado={pagado}
        pendiente={pendiente}
        pendingExpenseItems={getPendingLiquidityLineItems({
          transactions,
        })}
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
        planningOrphanCardPayments={
          summary.planningOrphanCardPayments ?? null
        }
        planningCardStatementDue={summary.planningCardStatementDue ?? null}
        planningWalletLoanDue={summary.planningWalletLoanDue ?? null}
        planningPayrollLoanDeduction={
          summary.planningPayrollLoanDeduction ?? null
        }
        planningBudgetRemaining={summary.planningBudgetRemaining ?? 0}
        fundingWalletBalanceTotal={summary.fundingWalletBalanceTotal}
        fundingNetVsPendingExpense={summary.fundingNetVsPendingExpense}
        fundingWalletBreakdown={summary.fundingWalletBreakdown}
      />

      {/* BOTTOM SECTION - Expense Tables */}
      <div className="space-y-6">
        {sortedDates.length === 0 ? (
          <EmptyState message="No hay movimientos para esta quincena" />
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
              wallets={wallets}
            />
          ))
        )}
      </div>
      </>
      )}
    </div>
  );
}
