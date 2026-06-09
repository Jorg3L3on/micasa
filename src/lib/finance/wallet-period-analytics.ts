import type { WalletMovement } from '@/types/wallet-movements';

export type WalletDailyFlowRow = {
  date: string;
  label: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulativeNet: number;
};

export type WalletCategoryBreakdownRow = {
  category: string;
  icon: string | null;
  amount: number;
  count: number;
  pct: number;
};

export type WalletMovementMix = {
  income: number;
  expense: number;
  cardPaymentIn: number;
  cardPaymentOut: number;
};

export type WalletPeriodAnalytics = {
  dailyFlow: WalletDailyFlowRow[];
  categoryBreakdown: WalletCategoryBreakdownRow[];
  movementMix: WalletMovementMix;
  daysInRange: number;
  activeDays: number;
  averageDailyOutflow: number;
  projectedMonthlyOutflow: number;
  largestInflow: WalletMovement | null;
  largestOutflow: WalletMovement | null;
};

type WalletPeriodRange = {
  from: string;
  to: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseYmdAsUtc = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatYmd = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

const dayLabel = (date: string) => String(Number(date.slice(8, 10)));

const inclusiveDays = (range: WalletPeriodRange) => {
  const from = parseYmdAsUtc(range.from);
  const to = parseYmdAsUtc(range.to);
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1);
};

const dateKeysInRange = (range: WalletPeriodRange) => {
  const days = inclusiveDays(range);
  const start = parseYmdAsUtc(range.from);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS);
    return formatYmd(date);
  });
};

const movementSignedAmount = (movement: WalletMovement) =>
  movement.direction === 'in' ? movement.amount : -movement.amount;

export const buildWalletPeriodAnalytics = (
  movements: WalletMovement[],
  range: WalletPeriodRange,
): WalletPeriodAnalytics => {
  const daily = new Map<string, { inflow: number; outflow: number }>();
  const categories = new Map<
    string,
    { icon: string | null; amount: number; count: number }
  >();
  const movementMix: WalletMovementMix = {
    income: 0,
    expense: 0,
    cardPaymentIn: 0,
    cardPaymentOut: 0,
  };

  let largestInflow: WalletMovement | null = null;
  let largestOutflow: WalletMovement | null = null;

  for (const movement of movements) {
    const dateKey = movement.date.slice(0, 10);
    const row = daily.get(dateKey) ?? { inflow: 0, outflow: 0 };

    if (movement.direction === 'in') {
      row.inflow += movement.amount;
      if (largestInflow == null || movement.amount > largestInflow.amount) {
        largestInflow = movement;
      }
      if (movement.kind === 'card_payment') {
        movementMix.cardPaymentIn += movement.amount;
      } else {
        movementMix.income += movement.amount;
      }
    } else {
      row.outflow += movement.amount;
      if (largestOutflow == null || movement.amount > largestOutflow.amount) {
        largestOutflow = movement;
      }
      if (movement.kind === 'card_payment') {
        movementMix.cardPaymentOut += movement.amount;
      } else {
        movementMix.expense += movement.amount;
      }

      const category = movement.category ?? 'Sin categoría';
      const categoryRow = categories.get(category) ?? {
        icon: movement.categoryIcon ?? null,
        amount: 0,
        count: 0,
      };
      categoryRow.amount += movement.amount;
      categoryRow.count += 1;
      if (categoryRow.icon == null && movement.categoryIcon != null) {
        categoryRow.icon = movement.categoryIcon;
      }
      categories.set(category, categoryRow);
    }

    daily.set(dateKey, row);
  }

  let cumulativeNet = 0;
  const dailyFlow = dateKeysInRange(range).map((date) => {
    const row = daily.get(date) ?? { inflow: 0, outflow: 0 };
    const net = row.inflow - row.outflow;
    cumulativeNet += net;
    return {
      date,
      label: dayLabel(date),
      inflow: row.inflow,
      outflow: row.outflow,
      net,
      cumulativeNet,
    };
  });

  const totalOutflow = movementMix.expense + movementMix.cardPaymentOut;
  const categoryBreakdown = Array.from(categories.entries())
    .map(([category, row]) => ({
      category,
      icon: row.icon,
      amount: row.amount,
      count: row.count,
      pct: totalOutflow > 0 ? Math.round((row.amount / totalOutflow) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const activeDays = dailyFlow.filter(
    (row) => row.inflow > 0 || row.outflow > 0,
  ).length;
  const daysInRange = dailyFlow.length;
  const averageDailyOutflow =
    activeDays > 0 ? totalOutflow / activeDays : 0;

  return {
    dailyFlow,
    categoryBreakdown,
    movementMix,
    daysInRange,
    activeDays,
    averageDailyOutflow,
    projectedMonthlyOutflow: averageDailyOutflow * daysInRange,
    largestInflow,
    largestOutflow,
  };
};

export const estimateWalletRunwayDays = (
  balance: number,
  averageDailyOutflow: number,
) => {
  if (averageDailyOutflow <= 0) return null;
  if (balance <= 0) return 0;
  return Math.floor(balance / averageDailyOutflow);
};

export const sumWalletMovementMix = (mix: WalletMovementMix) =>
  mix.income + mix.expense + mix.cardPaymentIn + mix.cardPaymentOut;

export const walletMovementNet = (movements: WalletMovement[]) =>
  movements.reduce((sum, movement) => sum + movementSignedAmount(movement), 0);
