'use client';

import { useMemo } from 'react';
import type { DashboardData } from '@/types/dashboard';
import { PeriodCategoryPieCard } from '@/components/charts/PeriodCategoryPieCard';

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

type DashboardPeriodCategoryPieProps = {
  period: DashboardData['period'];
  rows: DashboardData['periodCategoryBreakdown'];
};

export default function DashboardPeriodCategoryPie({
  period,
  rows,
}: DashboardPeriodCategoryPieProps) {
  const scopeLabel = useMemo(() => {
    const m = MONTH_LABELS[period.month - 1];
    if (period.view === 'biweekly') {
      const q = period.period === 'FIRST' ? '1ª' : '2ª';
      return `${q} quincena · ${m} ${period.year}`;
    }
    return `${m} ${period.year} (mes)`;
  }, [period]);

  const pieRows = useMemo(
    () =>
      rows.map((r) => ({
        category: r.category,
        categoryIcon: r.categoryIcon,
        total: r.total,
      })),
    [rows],
  );

  return (
    <PeriodCategoryPieCard
      scopeLabel={scopeLabel}
      rows={pieRows}
      compact={false}
    />
  );
}
