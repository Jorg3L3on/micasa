import { formatShortMonthLabel } from '@/components/wallets/liquidity/liquidity-personalization';
import {
  monthDebtPaymentsTotal,
  type MonthDebtItem,
} from '@/lib/finance/liquidity-month-debt-items';

export type LiquidityPayoffTone = 'active' | 'complete';

export type LiquidityPayoffProgress = {
  /** Share of today's debt already paid by the close of the selected month (0–100). */
  percent: number;
  tone: LiquidityPayoffTone;
  title: string;
  startLabel: string;
  endLabel: string;
  /** False when the last scheduled payment falls outside the projection. */
  payoffInHorizon: boolean;
};

type PayoffMonth = {
  month_key: string;
  outstanding_debt_total?: number | null;
  debt_items?: MonthDebtItem[] | null;
};

type BuildLiquidityPayoffProgressParams = {
  months: readonly PayoffMonth[];
  currentMonthKey: string;
  selectedMonthKey: string;
  payoffMonthKey: string | null;
};

const EPSILON = 0.005;

const monthIndex = (monthKey: string): number => {
  const [year, month] = monthKey.split('-').map(Number);
  return year * 12 + (month - 1);
};

export const monthsBetween = (fromMonthKey: string, toMonthKey: string): number =>
  monthIndex(toMonthKey) - monthIndex(fromMonthKey);

const payoffTitle = (monthsLeft: number, payoffInHorizon: boolean): string => {
  if (!payoffInHorizon) {
    const beyond = Math.max(1, monthsLeft);
    return `Más de ${beyond} ${beyond === 1 ? 'mes' : 'meses'}`;
  }
  if (monthsLeft <= 0) return 'Liquidas este mes';
  if (monthsLeft === 1) return '1 mes para liquidar';
  return `${monthsLeft} meses para liquidar`;
};

export const buildLiquidityPayoffProgress = ({
  months,
  currentMonthKey,
  selectedMonthKey,
  payoffMonthKey,
}: BuildLiquidityPayoffProgressParams): LiquidityPayoffProgress | null => {
  if (months.length === 0) return null;

  const baselineMonth = months.find((month) => month.month_key === currentMonthKey) ?? months[0]!;
  const selectedMonth = months.find((month) => month.month_key === selectedMonthKey) ?? baselineMonth;
  const lastMonth = months[months.length - 1]!;
  const startLabel = formatShortMonthLabel(baselineMonth.month_key);

  // Debt owed today = what is left at the close of this month plus this month's payments.
  const baseline =
    (baselineMonth.outstanding_debt_total ?? 0) +
    monthDebtPaymentsTotal(baselineMonth.debt_items ?? []);
  if (baseline <= EPSILON) {
    return {
      percent: 100,
      tone: 'complete',
      title: 'Sin deudas',
      startLabel,
      endLabel: startLabel,
      payoffInHorizon: true,
    };
  }

  const selectedOutstanding = selectedMonth.outstanding_debt_total ?? 0;
  const percent = Math.min(
    100,
    Math.max(0, Math.round((1 - selectedOutstanding / baseline) * 100)),
  );
  const endMonthKey = payoffMonthKey ?? lastMonth.month_key;
  const payoffInHorizon =
    payoffMonthKey != null &&
    !(payoffMonthKey === lastMonth.month_key && (lastMonth.outstanding_debt_total ?? 0) > EPSILON);

  return {
    percent,
    tone: selectedOutstanding <= EPSILON ? 'complete' : 'active',
    title: payoffTitle(monthsBetween(baselineMonth.month_key, endMonthKey), payoffInHorizon),
    startLabel,
    endLabel: formatShortMonthLabel(endMonthKey),
    payoffInHorizon,
  };
};
