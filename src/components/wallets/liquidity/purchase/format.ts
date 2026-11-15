import { currentCalendarYear, formatDisplayDate, formatMonthPhrase, formatMonthShort, formatMonthTitle } from '@/lib/calendar-dates';
import { formatMoney } from '@/lib/money';
import type { PurchasePlan } from '@/lib/finance/purchase-simulation/plan';
import type { QuincenaRow, VerdictFacts, VerdictLevel } from '@/lib/finance/purchase-simulation/series';
import { PURCHASE_COPY } from '@/components/wallets/liquidity/purchase/copy';

/** Pure text and grouping helpers for the Simular compra tab (MIC-I17). */

type QRef = Pick<QuincenaRow, 'year' | 'month' | 'period'>;

const ord = (r: QRef) => (r.period === 'FIRST' ? '1ª' : '2ª');

/** `2ª dic`, `1ª ene 27` outside the current year. */
export const quincenaShort = (r: QRef, now = new Date()) =>
  `${ord(r)} ${formatMonthShort(r.month)}${r.year !== currentCalendarYear(now) ? ` ${String(r.year).slice(2)}` : ''}`;

/** `2ª de diciembre`; adds the year when it is in a past month or more than 11 months away. */
export const quincenaMid = (r: QRef, now = new Date()) => {
  const today = new Date(now.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const ahead = (r.year - today.getFullYear()) * 12 + (r.month - (today.getMonth() + 1));
  return `${ord(r)} de ${formatMonthPhrase(r.month)}${ahead > 11 || ahead < 0 ? ` de ${r.year}` : ''}`;
};

export const quincenaTitle = (r: QRef, now = new Date()) =>
  `${ord(r)} quincena de ${formatMonthPhrase(r.month)}${r.year !== currentCalendarYear(now) ? ` ${r.year}` : ''}`;

export const quincenaRange = (r: QuincenaRow) =>
  `${formatDisplayDate(r.startYmd)} – ${formatDisplayDate(r.endYmd)}`;

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const joinNames = (names: string[]) => {
  const shown = names.slice(0, 3).map((n) => `la ${n}`);
  if (names.length > 3) return `${shown.join(', ')} y ${names.length - 3} más`;
  if (shown.length <= 1) return shown.join('');
  return `${shown.slice(0, -1).join(', ')} y ${shown.at(-1)}`;
};

export type VerdictCopy = {
  level: VerdictLevel;
  chip: string;
  headline: string;
  sentence: string;
  justa: string | null;
  compare: string;
  scope: string;
};

export function verdictCopy(
  facts: VerdictFacts,
  rows: QuincenaRow[],
  plan: PurchasePlan,
  cardName: string | null,
  now = new Date(),
): VerdictCopy {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const mid = (key: string) => quincenaMid(byKey.get(key)!, now);
  const n = facts.redKeys.length;
  let headline: string;
  let sentence: string;
  if (facts.level === 'green') {
    headline = 'Sí te alcanza';
    sentence = `Ninguna de tus ${facts.quincenas} quincenas queda en rojo. Lo más justo es la ${mid(facts.tightestKey)}: te quedarían ${formatMoney(facts.tightestQueda)}.`;
  } else if (facts.level === 'amber') {
    headline = `Te alcanza, pero aprieta ${n === 1 ? '1 quincena' : `${n} quincenas`}`;
    sentence = `${cap(joinNames(facts.redKeys.map(mid)))} ${n === 1 ? 'quedaría' : 'quedarían'} en rojo: te faltarían hasta ${formatMoney(-facts.tightestQueda)}. Las otras ${facts.quincenas - n} quincenas siguen con dinero, y lo que te sobra de antes alcanza para cubrirlo: tu dinero acumulado no baja de ${formatMoney(facts.lowestAcumulado)}.`;
  } else {
    headline = 'No te alcanza';
    const parts: string[] = [];
    if (facts.overLimitBy > 0) {
      parts.push(`Rebasa tu disponible en ${cardName ?? 'la tarjeta'} por ${formatMoney(facts.overLimitBy)}: la tienda podría rechazarla.`);
    }
    if (facts.firstNegativeAcumuladoKey) {
      parts.push(`Desde la ${mid(facts.firstNegativeAcumuladoKey)} ya no tendrías con qué cubrir tus pagos: tu dinero acumulado llegaría a ${formatMoney(facts.lowestAcumulado)}.`);
    }
    if (n > 0) {
      parts.push(`${n} de ${facts.quincenas} quincenas quedarían en rojo; la peor, la ${mid(facts.tightestKey)}, con ${formatMoney(facts.tightestQueda)}.`);
    }
    sentence = parts.join(' ');
  }
  if (facts.baselineRedCount > 0 && facts.level !== 'green') {
    const added = facts.newRedKeys.length;
    sentence += ` Sin la compra ya tenías ${facts.baselineRedCount} ${facts.baselineRedCount === 1 ? 'quincena' : 'quincenas'} en rojo; la compra ${added === 0 ? 'no agrega ninguna' : `agrega ${added}`}.`;
  }
  const j = facts.justaKeys.length;
  const justa =
    j > 0 && facts.level !== 'red'
      ? `Ojo: ${j === 1 ? '1 quincena queda justa' : `${j} quincenas quedan justas`} (te sobraría menos del 10% de lo que entra), por ejemplo la ${mid(facts.justaKeys[0])}.`
      : null;
  const last = rows.at(-1)!;
  return {
    level: facts.level,
    chip: PURCHASE_COPY.chip[facts.level],
    headline,
    sentence,
    justa,
    compare: `Sin la compra: ${facts.baselineRedCount === 0 ? 'ninguna quincena en rojo' : `${facts.baselineRedCount} en rojo`}; lo más justo sería ${formatMoney(facts.baselineTightest)}.`,
    scope: `Desde hoy hasta la ${quincenaMid(last, now)} · ${facts.quincenas} quincenas${plan.lastDueDate > last.endYmd ? ' · el periodo termina antes del último pago' : ''}`,
  };
}

export type Granularity = 'quincena' | 'mes' | 'año';

export const granularityFor = (count: number): Granularity =>
  count <= 48 ? 'quincena' : count <= 240 ? 'mes' : 'año';

export type ChartUnit = {
  key: string;
  label: string;
  axisLabel: string;
  sub: string;
  keys: string[];
  /** Quincena selected when this unit is tapped: the tightest one inside it. */
  selectKey: string;
  entra: number;
  comprometido: number;
  compra: number;
  queda: number;
  sinCompra: number;
  estimated: boolean;
  redCount: number;
};

export function groupUnits(rows: QuincenaRow[], g: Granularity, now = new Date()): ChartUnit[] {
  if (g === 'quincena') {
    return rows.map((r) => ({
      key: r.key,
      label: quincenaShort(r, now),
      axisLabel: r.period === 'FIRST' ? `${formatMonthShort(r.month)}${r.month === 1 ? ` ${String(r.year).slice(2)}` : ''}` : '',
      sub: quincenaRange(r),
      keys: [r.key],
      selectKey: r.key,
      entra: r.entra,
      comprometido: r.comprometido,
      compra: r.compra,
      queda: r.queda,
      sinCompra: r.sinCompra,
      estimated: r.estimated,
      redCount: r.queda < 0 ? 1 : 0,
    }));
  }
  const groups = new Map<string, QuincenaRow[]>();
  for (const r of rows) {
    const k = g === 'mes' ? `${r.year}-${String(r.month).padStart(2, '0')}` : String(r.year);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const step = g === 'mes' ? (groups.size <= 60 ? 3 : 6) : groups.size <= 15 ? 1 : 5;
  return [...groups.entries()].map(([key, list], i) => {
    const first = list[0];
    const tight = list.reduce((a, b) => (b.queda < a.queda ? b : a));
    const sum = (f: keyof Pick<QuincenaRow, 'entra' | 'comprometido' | 'compra' | 'queda' | 'sinCompra'>) =>
      Math.round(list.reduce((s, r) => s + r[f], 0) * 100) / 100;
    const redCount = list.filter((r) => r.queda < 0).length;
    const label = g === 'mes' ? `${formatMonthTitle(first.month)} ${first.year}` : String(first.year);
    const showAxis = g === 'mes' ? (first.month - 1) % step === 0 : i % step === 0;
    return {
      key,
      label,
      axisLabel: showAxis ? (g === 'mes' ? `${formatMonthShort(first.month)}${first.month === 1 ? ` ${String(first.year).slice(2)}` : ''}` : String(first.year)) : '',
      sub: redCount === 0 ? `Las ${list.length} quincenas con dinero` : `${redCount} ${redCount === 1 ? 'quincena' : 'quincenas'} en rojo`,
      keys: list.map((r) => r.key),
      selectKey: tight.key,
      entra: sum('entra'),
      comprometido: sum('comprometido'),
      compra: sum('compra'),
      queda: sum('queda'),
      sinCompra: sum('sinCompra'),
      estimated: list.every((r) => r.estimated),
      redCount,
    };
  });
}

export const levelTone = (level: VerdictLevel) =>
  level === 'green' ? 'success' : level === 'amber' ? 'pending' : 'overdue';
