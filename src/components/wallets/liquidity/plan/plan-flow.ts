import { fromCents, toCents } from '@/lib/finance/cash-plan/money';
import { isScenarioGapLine } from '@/lib/finance/cash-plan/from-liquidity';
import type { DataGap, GapBreakdownLine, Obligation, PlanInput } from '@/lib/finance/cash-plan/types';

export type FlowSegmentKey = 'fixed' | 'cards' | 'loans' | 'variable';

export type FlowSegmentDef = {
  key: FlowSegmentKey;
  label: string;
  /** CSS color for the bar segment and the row dot. */
  color: string;
};

/** Order and colors of the "Sale" bar: fijos, tarjetas, préstamos, variable. */
export const FLOW_SEGMENTS: readonly FlowSegmentDef[] = [
  { key: 'fixed', label: 'Fijos', color: 'var(--primary)' },
  { key: 'cards', label: 'Tarjetas', color: 'var(--chart-2)' },
  { key: 'loans', label: 'Préstamos', color: 'var(--chart-4)' },
  { key: 'variable', label: 'Variable', color: 'var(--muted-foreground)' },
];

export type FlowSegment = FlowSegmentDef & {
  total: number;
  /** 0–100, share of "Sale". */
  share: number;
};

export type PlanFlow = {
  inflow: { total: number; lines: GapBreakdownLine[] };
  outflow: {
    total: number;
    lines: GapBreakdownLine[];
    /** Null when a line cannot be placed in a segment (the month total). */
    segments: FlowSegment[] | null;
  };
  /** Entra − Sale. Positive = queda, negative = falta. Equals −gapAmount. */
  net: number;
  /** Gaps that belong to a line of "Sale", by line id. */
  lineGaps: Map<string, DataGap[]>;
  /** Gaps tied to an obligation that is not in the lines (left out of the sum). */
  orphanGaps: DataGap[];
  /** Gaps without an obligation (income, minimums). */
  generalGaps: DataGap[];
};

/** Which segment of "Sale" a line belongs to; null when it cannot be told. */
export const segmentForLine = (
  line: GapBreakdownLine,
  obligations: readonly Obligation[],
): FlowSegmentKey | null => {
  if (isScenarioGapLine(line)) return 'variable';
  if (line.id.startsWith('card-') || line.id.startsWith('msi-')) return 'cards';
  if (line.id.startsWith('loan-')) return 'loans';
  if (line.id.startsWith('bill-')) {
    const obligation = obligations.find((item) => item.id === line.id);
    return obligation?.discretionary ? 'variable' : 'fixed';
  }
  return null;
};

/** One row per code and obligation, first seen first. */
export const uniqueGaps = (gaps: readonly DataGap[]): DataGap[] =>
  gaps.filter(
    (gap, index) =>
      gaps.findIndex((item) => item.code === gap.code && item.obligationId === gap.obligationId) === index,
  );

/** Where the user completes the missing data, or null when there is no page for it. */
export const gapHref = (gap: DataGap): string | null => {
  const id = gap.obligationId ?? '';
  const card = /^card-(\d+)$/.exec(id);
  if (card) return `/credit-cards/${card[1]}`;
  if (id.startsWith('msi-')) return '/credit-cards';
  if (id.startsWith('loan-')) return '/loans';
  if (id.startsWith('bill-')) return '/expense-templates';
  if (gap.code === 'income_monthly_only') return '/income-templates';
  if (gap.code === 'missing_minimum' || gap.code === 'missing_statement') return '/credit-cards';
  return null;
};

/** Where an "Entra" line leads. */
export const inflowHref = (line: GapBreakdownLine): string | null => {
  if (line.id === 'cash') return '/wallets';
  if (line.id === 'month-income') return '/income-templates';
  return null;
};

/**
 * Splits the signed gap lines into Entra (negative lines) and Sale (positive
 * lines). The lines add up to `gapAmount`, so Entra − Sale = −gapAmount.
 */
export const buildPlanFlow = (
  input: Pick<PlanInput, 'gapLines' | 'obligations'>,
  dataGaps: readonly DataGap[],
): PlanFlow => {
  const inflowLines: GapBreakdownLine[] = [];
  const outflowLines: GapBreakdownLine[] = [];
  let inCents = 0;
  let outCents = 0;
  for (const line of input.gapLines) {
    const cents = toCents(line.amount);
    if (cents < 0) {
      inCents -= cents;
      inflowLines.push({ ...line, amount: fromCents(-cents) });
    } else if (cents > 0) {
      outCents += cents;
      outflowLines.push(line);
    }
  }

  const segmentCents = new Map<FlowSegmentKey, number>();
  let segmentable = outflowLines.length > 0;
  for (const line of outflowLines) {
    const key = segmentForLine(line, input.obligations);
    if (!key) {
      segmentable = false;
      break;
    }
    segmentCents.set(key, (segmentCents.get(key) ?? 0) + toCents(line.amount));
  }
  const segments = segmentable && outCents > 0
    ? FLOW_SEGMENTS.map((def) => {
      const cents = segmentCents.get(def.key) ?? 0;
      return { ...def, total: fromCents(cents), share: (cents / outCents) * 100 };
    })
    : null;

  const lineIds = new Set(outflowLines.map((line) => line.id));
  const lineGaps = new Map<string, DataGap[]>();
  const orphanGaps: DataGap[] = [];
  const generalGaps: DataGap[] = [];
  for (const gap of uniqueGaps(dataGaps)) {
    if (!gap.obligationId) {
      generalGaps.push(gap);
    } else if (lineIds.has(gap.obligationId)) {
      lineGaps.set(gap.obligationId, [...(lineGaps.get(gap.obligationId) ?? []), gap]);
    } else {
      orphanGaps.push(gap);
    }
  }

  return {
    inflow: { total: fromCents(inCents), lines: inflowLines },
    outflow: { total: fromCents(outCents), lines: outflowLines, segments },
    net: fromCents(inCents - outCents),
    lineGaps,
    orphanGaps,
    generalGaps,
  };
};
