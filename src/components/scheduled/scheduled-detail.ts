import { formatMoney } from '@/lib/money';
import {
  dueDayIn,
  perMonth,
  perYear,
  repeats,
  type ScheduledPeriod,
} from '@/lib/ui/scheduled-items';
import { NO_FIXED_DAY_TEXT, type ScheduledRowModel } from './scheduled-rows';

/**
 * What the read-first detail overlay shows: the caption under the amount and
 * the grouped rows. Rows with no value are left out.
 */

export const DETAIL_TITLE = {
  expense: 'Gasto programado',
  income: 'Ingreso programado',
} as const;

export const ACTIVE_HELPER = 'Se crea al abrir cada mes';

const CARD_WALLET_TYPES = new Set(['CREDIT_CARD', 'DEPARTMENT_STORE_CARD']);

export type DetailRow =
  | { key: string; label: string; kind: 'text'; value: string }
  | { key: string; label: string; kind: 'wallet'; value: string; iconKey: string | null };

/**
 * "por quincena · <al mes> al mes · <al año> al año" when it occurs in both
 * quincenas, "al mes · <al año> al año" when in one. Null when the amount is
 * variable; "Sin programar" when it applies to no quincena.
 */
export const detailCaption = (row: ScheduledRowModel): string | null => {
  const { item } = row;
  if (!repeats(item)) return 'Sin programar · no se crea solo';
  const month = perMonth(item);
  const year = perYear(item);
  if (month === null || year === null) return null;
  if (item.appliesFirst && item.appliesSecond) {
    return `por quincena · ${formatMoney(month)} al mes · ${formatMoney(year)} al año`;
  }
  return `al mes · ${formatMoney(year)} al año`;
};

const periodValue = (row: ScheduledRowModel, period: ScheduledPeriod): string => {
  if (row.item.kind === 'income') return 'Sí';
  const day = dueDayIn(row.item, period);
  return day === null ? NO_FIXED_DAY_TEXT : `Día ${day}`;
};

/** Corte comes from the card: shown only for an expense paid with a credit or store card that has one. */
export const cutoffDayOf = (row: ScheduledRowModel): number | null => {
  if (row.item.kind !== 'expense') return null;
  if (!row.walletType || !CARD_WALLET_TYPES.has(row.walletType)) return null;
  return row.walletCutoffDay ?? null;
};

/** "El corte se toma de Tarjeta del hogar." or null when there is no Corte row. */
export const cutoffHint = (row: ScheduledRowModel): string | null =>
  cutoffDayOf(row) !== null && row.walletName
    ? `El corte se toma de ${row.walletName}.`
    : null;

export const detailRows = (row: ScheduledRowModel): DetailRow[] => {
  const { item } = row;
  const rows: DetailRow[] = [];

  if (row.categoryName) {
    rows.push({ key: 'category', label: 'Categoría', kind: 'text', value: row.categoryName });
  }
  if (row.walletName) {
    rows.push({
      key: 'wallet',
      label: item.kind === 'expense' ? 'Paga con' : 'Billetera',
      kind: 'wallet',
      value: row.walletName,
      iconKey: row.walletIconKey,
    });
  }
  if (item.appliesFirst) {
    rows.push({ key: 'first', label: '1ª quincena', kind: 'text', value: periodValue(row, 'FIRST') });
  }
  if (item.appliesSecond) {
    rows.push({ key: 'second', label: '2ª quincena', kind: 'text', value: periodValue(row, 'SECOND') });
  }
  const cutoff = cutoffDayOf(row);
  if (cutoff !== null) {
    rows.push({ key: 'cutoff', label: 'Corte', kind: 'text', value: `Día ${cutoff}` });
  }
  if (item.kind === 'income') {
    if (row.source) rows.push({ key: 'source', label: 'Origen', kind: 'text', value: row.source });
    if (row.contributor) {
      rows.push({ key: 'contributor', label: 'Aporta', kind: 'text', value: row.contributor });
    }
  }
  return rows;
};
