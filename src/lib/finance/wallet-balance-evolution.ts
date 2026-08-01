import { addCalendarDays } from '@/lib/calendar-dates';
import { isCreditOrStoreCardWalletType } from '@/domain/payment-method';
import type { WalletMovement } from '@/types/wallet-movements';

export type WalletBalanceHistoryPoint = {
  /** es-MX month label for chart axis */
  date: string;
  /** Civil day used for the snapshot (YYYY-MM-DD) */
  as_of: string;
  value: number;
};

export type WalletBalanceMetrics = {
  current_balance: number;
  previous_balance: number;
  diff: number;
  history: WalletBalanceHistoryPoint[];
};

export const signedMovementDelta = (
  direction: 'in' | 'out',
  amount: number,
  isCredit: boolean,
): number => {
  const sign = direction === 'in' ? 1 : -1;
  return sign * amount * (isCredit ? -1 : 1);
};

export const balanceAtDate = (
  currentBalance: number,
  movements: ReadonlyArray<Pick<WalletMovement, 'date' | 'direction' | 'amount'>>,
  asOfDate: string,
  isCredit: boolean,
): number => {
  let deltaAfter = 0;
  for (const movement of movements) {
    if (movement.date > asOfDate) {
      deltaAfter += signedMovementDelta(
        movement.direction,
        movement.amount,
        isCredit,
      );
    }
  }
  return currentBalance - deltaAfter;
};

/** Month-end anchors for the last `months` civil months; latest point is `todayYmd`. */
export const buildRecentMonthAsOfDates = (
  months: number,
  todayYmd: string,
): string[] => {
  const [year, month] = todayYmd.split('-').map(Number);
  const result: string[] = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    let targetYear = year;
    let targetMonth = month - i;
    while (targetMonth <= 0) {
      targetMonth += 12;
      targetYear -= 1;
    }

    if (i === 0) {
      result.push(todayYmd);
    } else {
      const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
      result.push(
        `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      );
    }
  }

  return result;
};

const formatMonthChartLabel = (ymd: string): string => {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
};

export const buildWalletBalanceMetrics = (
  currentBalance: number,
  movements: ReadonlyArray<WalletMovement>,
  walletType: string,
  months: number,
  todayYmd: string,
): WalletBalanceMetrics => {
  const isCredit = isCreditOrStoreCardWalletType(walletType);
  const asOfDates = buildRecentMonthAsOfDates(months, todayYmd);

  const history = asOfDates.map((asOf) => ({
    date: formatMonthChartLabel(asOf),
    as_of: asOf,
    value: balanceAtDate(currentBalance, movements, asOf, isCredit),
  }));

  const current_balance = history[history.length - 1]?.value ?? currentBalance;
  const previous_balance =
    history.length > 1 ? (history[history.length - 2]?.value ?? current_balance) : current_balance;

  return {
    current_balance,
    previous_balance,
    diff: current_balance - previous_balance,
    history,
  };
};

/** First movement date to fetch when reconstructing balances (day after oldest anchor). */
export const metricsMovementsFromDate = (
  months: number,
  todayYmd: string,
): string => {
  const oldest = buildRecentMonthAsOfDates(months, todayYmd)[0];
  return addCalendarDays(oldest, 1);
};
