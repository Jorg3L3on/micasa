import { formatDisplayDate, parseCalendarDate } from '@/lib/calendar-dates';
import { formatCurrency } from '@/lib/utils';
import type { LiquidityScenarioItem } from '@/schemas/liquidity-scenario.schema';
import type {
  LiquidityProjectionResponse,
  LiquidityScenarioDelta,
} from '@/types/catalog';
import { SCENARIO_COPY } from '@/components/wallets/liquidity/scenario/copy';

const wholeCurrency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

/** Strip amounts: sign before the symbol, thousands with comma, no cents. */
export const formatWholeCurrency = (amount: number): string =>
  wholeCurrency.format(Math.round(amount) === 0 ? 0 : amount);

const signedWholeCurrency = (amount: number): string =>
  amount > 0 ? `+${formatWholeCurrency(amount)}` : formatWholeCurrency(amount);

export const scenarioDateOf = (item: LiquidityScenarioItem): string =>
  item.kind === 'purchase' ? item.date : item.firstDate;

/** "Una compra · $1,800 · 2 nov · Débito Nómina" */
export const describeScenarioItem = (
  item: LiquidityScenarioItem,
  walletName: string,
): string =>
  item.kind === 'purchase'
    ? [SCENARIO_COPY.purchase, formatCurrency(item.amount), formatDisplayDate(item.date), walletName].join(' · ')
    : [
        SCENARIO_COPY.instalment,
        `${formatCurrency(item.amount)} × ${item.months}`,
        `desde ${formatDisplayDate(item.firstDate)}`,
        walletName,
      ].join(' · ');

/** Name of the scenario wallet as the response knows it. */
export const scenarioWalletName = (
  data: LiquidityProjectionResponse | null,
  item: LiquidityScenarioItem,
  fallback = SCENARIO_COPY.wallet,
): string => {
  for (const milestone of data?.milestones ?? []) {
    for (const obligation of milestone.obligations) {
      if (obligation.source === 'scenario' && obligation.wallet_id === item.wallet_id) {
        return obligation.wallet_name;
      }
    }
  }
  return (
    data?.funding_wallets.find((wallet) => wallet.id === item.wallet_id)?.name ??
    data?.card_utilization_summary.cards.find((card) => card.card_id === item.wallet_id)?.card_name ??
    fallback
  );
};

/** Cash the scenario adds per month (YYYY-MM), from its obligations. */
export const scenarioCashByMonth = (
  data: LiquidityProjectionResponse | null,
): Map<string, number> => {
  const byMonth = new Map<string, number>();
  for (const milestone of data?.milestones ?? []) {
    for (const obligation of milestone.obligations) {
      if (obligation.source !== 'scenario') continue;
      const key = milestone.due_date.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + obligation.next_due_payment);
    }
  }
  return byMonth;
};

const daysBetween = (from: string, to: string): number =>
  Math.round((parseCalendarDate(to).getTime() - parseCalendarDate(from).getTime()) / 86_400_000);

export type ScenarioDeltaRow = {
  id: 'first_shortfall' | 'min_headroom' | 'end_liquidity';
  label: string;
  before: string;
  after: string;
  /** Null when the row did not move ("Sin cambio"). */
  change: string | null;
  /** Worse for the household: the UI tints only this text. */
  worse: boolean;
};

const formatShortfall = (date: string | null) => (date ? formatDisplayDate(date) : SCENARIO_COPY.none);

/** The three rows of the delta strip, base → scenario. */
export const buildScenarioDeltaRows = (
  delta: LiquidityScenarioDelta,
  until: string,
): ScenarioDeltaRow[] => {
  const { baseline, scenario } = delta;
  const shortfallBefore = baseline.first_projected_shortfall_date;
  const shortfallAfter = scenario.first_projected_shortfall_date;
  let shortfallChange: string | null = null;
  let shortfallWorse = false;
  if (delta.first_projected_shortfall_changed) {
    if (shortfallBefore && shortfallAfter) {
      const days = daysBetween(shortfallAfter, shortfallBefore);
      shortfallWorse = days > 0;
      shortfallChange = days > 0 ? SCENARIO_COPY.daysEarlier(days) : SCENARIO_COPY.daysLater(-days);
    } else if (shortfallAfter) {
      shortfallWorse = true;
      shortfallChange = SCENARIO_COPY.newShortfall;
    } else {
      shortfallChange = SCENARIO_COPY.shortfallGone;
    }
  }

  const headroomChange = delta.min_projected_headroom_change;
  const headroomMoved = headroomChange != null ? Math.round(headroomChange) !== 0 : baseline.min_projected_headroom !== scenario.min_projected_headroom;
  const endMoved = Math.round(delta.end_liquidity_change) !== 0;

  return [
    {
      id: 'first_shortfall',
      label: SCENARIO_COPY.deltaFirstShortfall,
      before: formatShortfall(shortfallBefore),
      after: formatShortfall(shortfallAfter),
      change: shortfallChange,
      worse: shortfallWorse,
    },
    {
      id: 'min_headroom',
      label: SCENARIO_COPY.deltaMinHeadroom,
      before: baseline.min_projected_headroom == null ? SCENARIO_COPY.none : formatWholeCurrency(baseline.min_projected_headroom),
      after: scenario.min_projected_headroom == null ? SCENARIO_COPY.none : formatWholeCurrency(scenario.min_projected_headroom),
      change: headroomMoved && headroomChange != null ? signedWholeCurrency(headroomChange) : null,
      worse: headroomMoved && (headroomChange ?? 0) < 0,
    },
    {
      id: 'end_liquidity',
      label: SCENARIO_COPY.deltaEnd(formatDisplayDate(until)),
      before: formatWholeCurrency(baseline.end_liquidity),
      after: formatWholeCurrency(scenario.end_liquidity),
      change: endMoved ? signedWholeCurrency(delta.end_liquidity_change) : null,
      worse: endMoved && delta.end_liquidity_change < 0,
    },
  ];
};

export const scenarioMovesNothing = (rows: ScenarioDeltaRow[]): boolean =>
  rows.every((row) => row.change == null);
