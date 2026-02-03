import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import CreateMonthCard from '@/components/CreateMonthCard';
import { DashboardTabs } from '@/components/dashboard';
import type { DashboardData } from '@/types/dashboard';

export const metadata: Metadata = {
  title: 'Dashboard | MiCasa',
  description: 'Resumen de ingresos, gastos y balance por categoría.',
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
      <DashboardTabs data={dashboardData} />
    </>
  );
}
