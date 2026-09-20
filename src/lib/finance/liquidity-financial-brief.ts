import { compareMonthKeys, monthKeyFromParts, shiftMonthKey } from '@/lib/finance/liquidity-chart-range';
import {
  monthDebtPaymentsTotal,
  type MonthDebtItem,
} from '@/lib/finance/liquidity-month-debt-items';
import type { LiquidityMonthlySeriesItem, LiquidityProjectionEvent, LiquidityProjectionResponse } from '@/types/catalog';
import type { LiquidityYtdContext } from '@/lib/finance/liquidity-ytd-context';

const formatMonthYearLabel = (monthKey: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, 1));
  const raw = d.toLocaleDateString('es-MX', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

export type LiquidityBriefTone = 'positive' | 'neutral' | 'caution' | 'critical';

export type LiquidityBriefMetric = {
  label: string;
  value: number;
  accent: 'emerald' | 'violet' | 'amber' | 'destructive' | 'muted';
};

export type LiquidityFinancialBrief = {
  asOfMonthKey: string;
  tone: LiquidityBriefTone;
  headline: string;
  subline: string;
  metrics: LiquidityBriefMetric[];
  insights: string[];
  compareLine: string | null;
  actionNow: string | null;
  ytd: LiquidityYtdContext | null;
};

const sumPayments = (months: readonly LiquidityMonthlySeriesItem[]): number =>
  months.reduce((sum, month) => sum + monthDebtPaymentsTotal(month.debt_items ?? []), 0);

const outstandingAt = (
  months: readonly LiquidityMonthlySeriesItem[],
  monthKey: string,
): number | null => {
  const row = months.find((month) => month.month_key === monthKey);
  if (!row) return null;
  return row.outstanding_debt_total ?? 0;
};

const tightestIn = (
  months: readonly LiquidityMonthlySeriesItem[],
): { monthKey: string; remaining: number } | null => {
  let tightest: { monthKey: string; remaining: number } | null = null;
  for (const month of months) {
    if (tightest == null || month.monthly_remaining < tightest.remaining) {
      tightest = { monthKey: month.month_key, remaining: month.monthly_remaining };
    }
  }
  return tightest;
};

const payoffCountFrom = (data: LiquidityProjectionResponse, fromMonthKey: string): number =>
  data.projection_events.filter((event) => compareMonthKeys(event.month_key, fromMonthKey) >= 0)
    .length;

const debtDeclinesThroughYear = (
  months: readonly LiquidityMonthlySeriesItem[],
  fromMonthKey: string,
  endMonthKey: string,
): boolean | null => {
  const start = outstandingAt(months, fromMonthKey);
  const end = outstandingAt(months, endMonthKey);
  if (start == null || end == null) return null;
  return end < start - 1;
};

const heaviestPaymentMonth = (
  months: readonly LiquidityMonthlySeriesItem[],
): { monthKey: string; amount: number } | null => {
  let heaviest: { monthKey: string; amount: number } | null = null;
  for (const month of months) {
    const amount = monthDebtPaymentsTotal(month.debt_items ?? []);
    if (amount <= 0) continue;
    if (heaviest == null || amount > heaviest.amount) {
      heaviest = { monthKey: month.month_key, amount };
    }
  }
  return heaviest;
};

/** Executive-style brief: liquidity today, rest-of-year vs next-year payments, debt trajectory. */
export const buildLiquidityFinancialBrief = (
  data: LiquidityProjectionResponse,
  ytd: LiquidityYtdContext | null = null,
): LiquidityFinancialBrief => {
  const asOfMonthKey = data.as_of.slice(0, 7);
  const [currentYear] = asOfMonthKey.split('-').map(Number);
  const nextYear = currentYear + 1;
  const yearEndKey = monthKeyFromParts(currentYear, 12);
  const nextYearEndKey = monthKeyFromParts(nextYear, 12);

  const thisYearMonths = data.monthly_series.filter((month) =>
    month.month_key.startsWith(`${currentYear}-`),
  );
  const nextYearMonths = data.monthly_series.filter((month) =>
    month.month_key.startsWith(`${nextYear}-`),
  );
  const restOfThisYear = thisYearMonths.filter(
    (month) => compareMonthKeys(month.month_key, asOfMonthKey) >= 0,
  );
  const futureNextYear = nextYearMonths.filter(
    (month) => compareMonthKeys(month.month_key, asOfMonthKey) > 0,
  );

  const fundingTotal = data.summary.funding_total;
  const outstandingNow =
    outstandingAt(data.monthly_series, asOfMonthKey) ??
    data.monthly_series.find((month) => month.month_key === asOfMonthKey)?.outstanding_debt_total ??
    0;
  const paymentsRestOfYear = sumPayments(restOfThisYear);
  const paymentsNextYear = sumPayments(futureNextYear);
  const outstandingYearEnd = outstandingAt(thisYearMonths, yearEndKey);
  const outstandingNextYearEnd = outstandingAt(nextYearMonths, nextYearEndKey);
  const tightestRest = tightestIn(restOfThisYear);
  const payoffsAhead = payoffCountFrom(data, asOfMonthKey);
  const dangerousCards = data.card_utilization_summary.dangerous_count;
  const debtFalling = debtDeclinesThroughYear(
    data.monthly_series,
    asOfMonthKey,
    yearEndKey,
  );

  let tone: LiquidityBriefTone = 'neutral';
  if (
    (tightestRest?.remaining ?? 0) < -500 ||
    data.summary.first_projected_shortfall_date != null
  ) {
    tone = 'critical';
  } else if (
    (tightestRest?.remaining ?? 0) < 0 ||
    dangerousCards > 0 ||
    outstandingNow > fundingTotal * 3
  ) {
    tone = 'caution';
  } else if (debtFalling === true && (tightestRest?.remaining ?? 0) >= 0) {
    tone = 'positive';
  }

  const headline = buildHeadline({
    tone,
    tightestRest,
    outstandingNow,
    fundingTotal,
    payoffsAhead,
    debtFalling,
  });

  const subline = buildSubline({
    currentYear,
    nextYear,
    paymentsRestOfYear,
    paymentsNextYear,
    outstandingYearEnd,
    outstandingNextYearEnd,
  });

  const metrics: LiquidityBriefMetric[] = [
    {
      label: 'Liquidez hoy',
      value: fundingTotal,
      accent: fundingTotal > 0 ? 'emerald' : 'muted',
    },
    {
      label: 'Adeudo total',
      value: outstandingNow,
      accent: 'amber',
    },
    {
      label: `Pagos · resto ${currentYear}`,
      value: paymentsRestOfYear,
      accent: 'violet',
    },
  ];

  if (futureNextYear.length > 0) {
    metrics.push({
      label: `Pagos · ${nextYear}`,
      value: paymentsNextYear,
      accent: 'violet',
    });
  }

  const insights = buildInsights({
    tightestRest,
    payoffsAhead,
    dangerousCards,
    debtFalling,
    outstandingYearEnd,
    outstandingNow,
    currentYear,
  });

  const compareLine = buildCompareLine({
    currentYear,
    nextYear,
    paymentsRestOfYear,
    paymentsNextYear,
    outstandingYearEnd,
    outstandingNextYearEnd,
    futureNextYearLength: futureNextYear.length,
  });

  const actionNow = buildActionNow({
    tightestRest,
    restOfThisYear,
    debtFalling,
    outstandingYearEnd,
    asOfMonthKey,
    projectionEvents: data.projection_events,
    cardUtilization: data.card_utilization_summary,
  });

  return {
    asOfMonthKey,
    tone,
    headline,
    subline,
    metrics,
    insights,
    compareLine,
    actionNow,
    ytd,
  };
};

const buildHeadline = (input: {
  tone: LiquidityBriefTone;
  tightestRest: { monthKey: string; remaining: number } | null;
  outstandingNow: number;
  fundingTotal: number;
  payoffsAhead: number;
  debtFalling: boolean | null;
}): string => {
  const { tone, tightestRest, outstandingNow, fundingTotal, payoffsAhead, debtFalling } = input;

  if (tone === 'critical' && tightestRest && tightestRest.remaining < 0) {
    return `Presión en ${formatMonthYearLabel(tightestRest.monthKey)}: tus pagos superan lo disponible ese mes.`;
  }

  if (tone === 'positive' && payoffsAhead > 0) {
    return `Trayectoria favorable: tu adeudo baja y ${payoffsAhead} ${payoffsAhead === 1 ? 'compromiso termina' : 'compromisos terminan'} en el horizonte.`;
  }

  if (debtFalling === true) {
    return 'Tu adeudo total va a la baja hacia fin de año; mantén el ritmo de pagos.';
  }

  if (outstandingNow > fundingTotal && fundingTotal > 0) {
    return 'Tu deuda supera la liquidez disponible; prioriza pagos y evita nuevos cargos.';
  }

  if (fundingTotal <= 0 && outstandingNow > 0) {
    return 'Sin colchón de efectivo hoy; cualquier imprevisto presionaría tus finanzas.';
  }

  return 'Panorama estable: revisa el mes más exigente y ajusta antes de que llegue.';
};

const buildSubline = (input: {
  currentYear: number;
  nextYear: number;
  paymentsRestOfYear: number;
  paymentsNextYear: number;
  outstandingYearEnd: number | null;
  outstandingNextYearEnd: number | null;
}): string => {
  const parts: string[] = [];
  if (input.paymentsRestOfYear > 0) {
    parts.push(`comprometiste pagos por el resto de ${input.currentYear}`);
  }
  if (input.paymentsNextYear > 0) {
    parts.push(`y ${input.nextYear} proyecta carga adicional`);
  }
  if (parts.length === 0) {
    return `Resumen financiero ${input.currentYear}.`;
  }
  return `Vista al ${input.currentYear}: ${parts.join(' ')}.`;
};

const buildInsights = (input: {
  tightestRest: { monthKey: string; remaining: number } | null;
  payoffsAhead: number;
  dangerousCards: number;
  debtFalling: boolean | null;
  outstandingYearEnd: number | null;
  outstandingNow: number;
  currentYear: number;
}): string[] => {
  const insights: string[] = [];

  if (input.tightestRest) {
    if (input.tightestRest.remaining < 0) {
      insights.push(
        `Mes más apretado: ${formatMonthYearLabel(input.tightestRest.monthKey)} (${formatSignedMoney(input.tightestRest.remaining)} vs ingresos).`,
      );
    } else {
      insights.push(
        `Mes más exigente: ${formatMonthYearLabel(input.tightestRest.monthKey)}; aún te alcanza con margen.`,
      );
    }
  }

  if (input.debtFalling === true && input.outstandingYearEnd != null) {
    insights.push(
      `Adeudo al cierre de ${input.currentYear}: ${formatMoney(input.outstandingYearEnd)} (desde ${formatMoney(input.outstandingNow)} hoy).`,
    );
  } else if (input.debtFalling === false && input.outstandingYearEnd != null) {
    insights.push(
      `El adeudo podría subir a ${formatMoney(input.outstandingYearEnd)} al cierre de ${input.currentYear}; conviene contener nuevas compras a meses.`,
    );
  }

  if (input.payoffsAhead > 0) {
    insights.push(
      `${input.payoffsAhead} ${input.payoffsAhead === 1 ? 'pago termina' : 'pagos terminan'} en los próximos meses (ver puntos verdes en la gráfica).`,
    );
  }

  if (input.dangerousCards > 0) {
    insights.push(
      `${input.dangerousCards} ${input.dangerousCards === 1 ? 'tarjeta supera' : 'tarjetas superan'} el 80% de su límite.`,
    );
  }

  return insights.slice(0, 3);
};

const buildCompareLine = (input: {
  currentYear: number;
  nextYear: number;
  paymentsRestOfYear: number;
  paymentsNextYear: number;
  outstandingYearEnd: number | null;
  outstandingNextYearEnd: number | null;
  futureNextYearLength: number;
}): string | null => {
  if (input.paymentsRestOfYear <= 0 && input.paymentsNextYear <= 0) return null;

  const restLabel = `Resto ${input.currentYear}: ${formatMoney(input.paymentsRestOfYear)} en pagos`;
  if (input.futureNextYearLength === 0) {
    return restLabel;
  }

  const nextLabel = `${input.nextYear}: ${formatMoney(input.paymentsNextYear)} proyectados`;
  let line = `${restLabel} · ${nextLabel}`;

  if (input.outstandingYearEnd != null && input.outstandingNextYearEnd != null) {
    const delta = input.outstandingNextYearEnd - input.outstandingYearEnd;
    if (Math.abs(delta) >= 100) {
      line += delta < 0
        ? ` · adeudo bajaría ${formatMoney(Math.abs(delta))} entre dic ${input.currentYear} y dic ${input.nextYear}`
        : ` · adeudo subiría ${formatMoney(delta)} entre dic ${input.currentYear} y dic ${input.nextYear}`;
    }
  }

  return line;
};

const buildActionNow = (input: {
  tightestRest: { monthKey: string; remaining: number } | null;
  restOfThisYear: readonly LiquidityMonthlySeriesItem[];
  debtFalling: boolean | null;
  outstandingYearEnd: number | null;
  asOfMonthKey: string;
  projectionEvents: readonly LiquidityProjectionEvent[];
  cardUtilization: LiquidityProjectionResponse['card_utilization_summary'];
}): string | null => {
  if (input.tightestRest && input.tightestRest.remaining < 0) {
    const month = input.restOfThisYear.find(
      (row) => row.month_key === input.tightestRest!.monthKey,
    );
    const amount = month ? monthDebtPaymentsTotal(month.debt_items ?? []) : 0;
    return `Anticipa ${formatMoney(amount)} para ${formatMonthYearLabel(input.tightestRest.monthKey)}; es tu mes más exigente.`;
  }

  const dangerousCards = input.cardUtilization.cards.filter((card) => card.is_danger);
  if (dangerousCards.length > 0) {
    const first = dangerousCards[0]!.card_name;
    if (dangerousCards.length === 1) {
      return `Baja el uso de ${first} antes del corte.`;
    }
    return `Baja el uso de ${first} y otras ${dangerousCards.length - 1} tarjetas antes del corte.`;
  }

  if (input.debtFalling === false && input.outstandingYearEnd != null) {
    return 'Evita nuevas compras a meses; tu adeudo sube hacia diciembre.';
  }

  const payoffHorizon = shiftMonthKey(input.asOfMonthKey, 3);
  const upcomingPayoff = [...input.projectionEvents]
    .filter(
      (event) =>
        compareMonthKeys(event.month_key, input.asOfMonthKey) >= 0 &&
        compareMonthKeys(event.month_key, payoffHorizon) <= 0,
    )
    .sort((a, b) => compareMonthKeys(a.month_key, b.month_key))[0];
  if (upcomingPayoff) {
    const shortTitle = upcomingPayoff.title.replace(/^Terminas de pagar\s+/i, '');
    return `Mantén el pago de ${shortTitle}; termina en ${formatMonthYearLabel(upcomingPayoff.month_key)}.`;
  }

  const heaviest = heaviestPaymentMonth(input.restOfThisYear);
  if (heaviest) {
    return `Aparta ${formatMoney(heaviest.amount)} para ${formatMonthYearLabel(heaviest.monthKey)}; es el mes con más pagos.`;
  }

  return 'Revisa la gráfica y aparta con anticipación lo que toca pagar cada mes.';
};

const formatMoney = (value: number): string =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);

const formatSignedMoney = (value: number): string => {
  const formatted = formatMoney(Math.abs(value));
  return value < 0 ? `−${formatted}` : formatted;
};

/** @internal test helper */
export const _sumPaymentsForTest = sumPayments;

/** @internal test helper */
export const _paymentsFromItems = (items: MonthDebtItem[]): number =>
  monthDebtPaymentsTotal(items);
