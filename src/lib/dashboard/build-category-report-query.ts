import type { DashboardData } from '@/types/dashboard';

/** Same fortnight scope as the dashboard KPIs when paired with `planningCashFlow=true`. */
export const buildCategoryReportApiPath = (
  period: DashboardData['period'],
): string => {
  const q = new URLSearchParams();
  q.set('type', 'by-category');
  q.set('month', String(period.month));
  q.set('year', String(period.year));
  q.set('planningCashFlow', 'true');
  if (period.view === 'biweekly') {
    q.set('period', period.period);
  }
  return `/api/reports?${q.toString()}`;
};
