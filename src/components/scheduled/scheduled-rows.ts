import type {
  ExpenseTemplateListItem,
  IncomeTemplateListItem,
  WalletListItem,
} from '@/types/catalog';
import {
  dueDayIn,
  fromExpenseTemplate,
  fromIncomeTemplate,
  repeats,
  scheduleLabels,
  type ScheduledItem,
  type ScheduledKind,
  type ScheduledView,
} from '@/lib/ui/scheduled-items';

/**
 * What a Gastos / Ingresos programados row shows besides the figures that
 * `scheduled-items` computes: category, wallet and the search text.
 */
export type ScheduledRowModel = {
  item: ScheduledItem;
  /** Line under the name from `md` (category, and the source for incomes). */
  detail: string | null;
  categoryIcon: string | null;
  walletName: string | null;
  walletIconKey: string | null;
};

export type ScheduledFilters = {
  query: string;
  subscriptionsOnly: boolean;
  variableOnly: boolean;
};

export const NO_WALLET_LABEL = 'Sin billetera';
export const NO_DATE_LABEL = 'Sin fecha';
export const NO_FIXED_DAY_TEXT = 'Sin día fijo';

export const KIND_COPY: Record<
  ScheduledKind,
  {
    singular: string;
    plural: string;
    /** "gastos" / "ingresos", for counts. */
    countNoun: string;
    walletColumn: string;
    createLabel: string;
  }
> = {
  expense: {
    singular: 'gasto programado',
    plural: 'gastos programados',
    countNoun: 'gastos',
    walletColumn: 'Paga con',
    createLabel: 'Agregar gasto programado',
  },
  income: {
    singular: 'ingreso programado',
    plural: 'ingresos programados',
    countNoun: 'ingresos',
    walletColumn: 'Se deposita en',
    createLabel: 'Agregar ingreso programado',
  },
};

export const expenseRows = (
  items: readonly ExpenseTemplateListItem[],
): ScheduledRowModel[] =>
  items.map((item) => ({
    item: fromExpenseTemplate(item),
    detail: item.category || null,
    categoryIcon: item.categoryIcon ?? null,
    walletName: item.paymentMethod ?? null,
    walletIconKey: item.paymentMethodProviderIconKey ?? null,
  }));

export const incomeRows = (
  items: readonly IncomeTemplateListItem[],
  wallets: readonly Pick<WalletListItem, 'id' | 'name' | 'provider_icon_key'>[],
): ScheduledRowModel[] => {
  const byId = new Map(wallets.map((w) => [w.id, w]));
  return items.map((item) => {
    const wallet = item.walletId != null ? byId.get(item.walletId) : undefined;
    const detail = [item.categoryName, item.source]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(' · ');
    return {
      item: fromIncomeTemplate(item),
      detail: detail || null,
      categoryIcon: item.categoryIcon ?? null,
      walletName: wallet?.name ?? null,
      walletIconKey: wallet?.provider_icon_key ?? null,
    };
  });
};

const fold = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('es-MX')
    .trim();

/** Name, category / source and wallet, accent- and case-insensitive. */
export const matchesQuery = (row: ScheduledRowModel, query: string): boolean => {
  const needle = fold(query);
  if (!needle) return true;
  return [row.item.name, row.detail, row.walletName]
    .filter((part): part is string => Boolean(part))
    .some((part) => fold(part).includes(needle));
};

export const filterRows = (
  rows: readonly ScheduledRowModel[],
  filters: ScheduledFilters,
): ScheduledRowModel[] =>
  rows.filter((row) => {
    if (filters.subscriptionsOnly && !row.item.isSubscription) return false;
    if (filters.variableOnly && row.item.amount !== null) return false;
    return matchesQuery(row, filters.query);
  });

/** Chip counts: active items only, like the summary. */
export const chipCounts = (rows: readonly ScheduledRowModel[]) => {
  let subscriptions = 0;
  let variable = 0;
  for (const { item } of rows) {
    if (!item.active) continue;
    if (item.isSubscription) subscriptions += 1;
    if (item.amount === null) variable += 1;
  }
  return { subscriptions, variable };
};

/** Active items that repeat at least once a month. */
export const programadosCount = (rows: readonly ScheduledRowModel[]): number =>
  rows.filter(({ item }) => item.active && repeats(item)).length;

/** Active subscriptions that repeat (the "n al mes" under Suscripciones). */
export const subscriptionsCount = (rows: readonly ScheduledRowModel[]): number =>
  rows.filter(({ item }) => item.active && repeats(item) && item.isSubscription)
    .length;

const quincenaPhrase = (item: ScheduledItem): string | null => {
  if (item.appliesFirst && item.appliesSecond) return '1ª y 2ª quincena';
  if (item.appliesFirst) return '1ª quincena';
  if (item.appliesSecond) return '2ª quincena';
  return null;
};

/**
 * When, for the phone row. In a quincena view an expense says its day
 * ("Día 5", "Sin día fijo"); in Todas it says the quincena labels
 * ("1ª · día 12, 2ª · día 26"). Incomes have no day: "1ª y 2ª quincena".
 */
export const whenText = (item: ScheduledItem, view: ScheduledView): string => {
  if (!repeats(item)) return NO_DATE_LABEL;
  if (item.kind === 'income') {
    if (view === 'first') return '1ª quincena';
    if (view === 'second') return '2ª quincena';
    return quincenaPhrase(item) ?? NO_DATE_LABEL;
  }
  if (view !== 'all') {
    const day = dueDayIn(item, view === 'first' ? 'FIRST' : 'SECOND');
    return day === null ? NO_FIXED_DAY_TEXT : `Día ${day}`;
  }
  return scheduleLabels(item).join(', ');
};

/** "Día 5 · Tarjeta del hogar". */
export const mobileLine = (row: ScheduledRowModel, view: ScheduledView): string =>
  `${whenText(row.item, view)} · ${row.walletName ?? NO_WALLET_LABEL}`;

/** "8 gastos · 1 con monto variable". */
export const countLine = (
  kind: ScheduledKind,
  count: number,
  variableCount: number,
  /** Phone cells: "1 variable". */
  short = false,
): string => {
  const noun =
    count === 1 ? KIND_COPY[kind].countNoun.replace(/s$/, '') : KIND_COPY[kind].countNoun;
  const base = `${count} ${noun}`;
  if (variableCount === 0) return base;
  return `${base} · ${variableCount} ${short ? 'variable' : 'con monto variable'}`;
};

/** Share of the month in each quincena, rounded so both add to 100. */
export const splitPercent = (
  first: number,
  second: number,
): { first: number; second: number } | null => {
  const total = first + second;
  if (!(total > 0)) return null;
  const firstPct = Math.round((first / total) * 100);
  return { first: firstPct, second: 100 - firstPct };
};
