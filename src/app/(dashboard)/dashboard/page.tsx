import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/EmptyState';
import CreateMonthCard from '@/components/CreateMonthCard';
import { formatCurrency } from '@/lib/utils';
import type { DashboardData } from '@/types/dashboard';
import {
  CurrentPeriodSummaryCard,
  AvailableVsCommittedCard,
  UpcomingObligationsCard,
  RecentActivityCard,
  IncomeBreakdownCard,
  ExpenseHealthCheckCard,
  FixedVsVariableCard,
  QuickActionsCard,
  AlertsWarningsCard,
  PeriodComparisonCard,
} from '@/components/dashboard';

export const metadata: Metadata = {
  title: 'Dashboard | MiCasa',
  description: 'Resumen de ingresos, gastos y balance por categoría.',
};

type CategoryTotal = {
  category: string;
  total: number;
};

async function getDashboardData(searchParams: {
  view?: string;
  month?: string;
  year?: string;
  period?: string;
}): Promise<DashboardData | null> {
  try {
    const query = new URLSearchParams();
    if (searchParams.view) query.set('view', searchParams.view);
    if (searchParams.month) query.set('month', searchParams.month);
    if (searchParams.year) query.set('year', searchParams.year);
    if (searchParams.period) query.set('period', searchParams.period);
    return await fetchFromApi<DashboardData>(
      `/api/dashboard?${query.toString()}`,
    );
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return null;
  }
}

async function getByCategory(period: {
  year: number;
  month: number;
  period: string;
}): Promise<CategoryTotal[]> {
  try {
    const query = new URLSearchParams({
      type: 'by-category',
      month: String(period.month),
      year: String(period.year),
      period: period.period,
    });
    return await fetchFromApi<CategoryTotal[]>(
      `/api/reports?${query.toString()}`,
    );
  } catch (error) {
    console.error('Error fetching category totals:', error);
    return [];
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    month?: string;
    year?: string;
    period?: string;
  }>;
}) {
  const params = await searchParams;
  const dashboardData = await getDashboardData(params);
  const byCategory = dashboardData
    ? await getByCategory(dashboardData.period)
    : [];

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <p className="text-destructive">
          No se pudo cargar el dashboard. Revisa la conexión e intenta de nuevo.
        </p>
        <CreateMonthCard />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <CurrentPeriodSummaryCard data={dashboardData} />
        <AvailableVsCommittedCard data={dashboardData} />
        <UpcomingObligationsCard data={dashboardData} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <RecentActivityCard data={dashboardData} />
        <IncomeBreakdownCard data={dashboardData} />
        <ExpenseHealthCheckCard data={dashboardData} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <FixedVsVariableCard data={dashboardData} />
        <QuickActionsCard />
        <AlertsWarningsCard data={dashboardData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <PeriodComparisonCard data={dashboardData} />
      </div>

      <div className="mb-8">
        <CreateMonthCard />
      </div>
    </>
  );
}
