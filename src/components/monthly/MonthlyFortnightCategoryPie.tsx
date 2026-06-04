'use client';

import { useMemo } from 'react';
import { PeriodCategoryPieCard } from '@/components/charts/PeriodCategoryPieCard';
import type { CategoryPieRow } from '@/components/charts/period-category-pie';
import { useMonthlyPanelPreferences } from '@/components/monthly/MonthlyPanelPreferences';
import type { TransactionRow } from '@/types/catalog';

const MONTH_LABELS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const breakdownFromTransactions = (
  transactions: TransactionRow[],
): CategoryPieRow[] => {
  const totals = new Map<string, { total: number; icon: string | null }>();
  for (const tx of transactions) {
    if (tx.type === 'income') continue;
    const name = tx.category?.trim() || 'Sin categoría';
    const prev = totals.get(name);
    const amount = Number(tx.amount) || 0;
    if (prev) {
      prev.total += amount;
    } else {
      totals.set(name, { total: amount, icon: tx.categoryIcon ?? null });
    }
  }
  return Array.from(totals.entries()).map(([category, data]) => ({
    category,
    categoryIcon: data.icon,
    total: data.total,
  }));
};

type MonthlyFortnightCategoryPieProps = {
  year: number;
  month: number;
  firstTransactions: TransactionRow[];
  secondTransactions: TransactionRow[];
};

export const MonthlyFortnightCategoryPie = ({
  year,
  month,
  firstTransactions,
  secondTransactions,
}: MonthlyFortnightCategoryPieProps) => {
  const { period } = useMonthlyPanelPreferences();

  const rows = useMemo(() => {
    const txns = period === 'FIRST' ? firstTransactions : secondTransactions;
    return breakdownFromTransactions(txns);
  }, [period, firstTransactions, secondTransactions]);

  const scopeLabel = useMemo(() => {
    const m = MONTH_LABELS[month - 1] ?? '';
    const q = period === 'FIRST' ? '1ª' : '2ª';
    return `${q} quincena · ${m} ${year}`;
  }, [month, year, period]);

  return (
    <PeriodCategoryPieCard
      scopeLabel={scopeLabel}
      rows={rows}
      compact
    />
  );
};
