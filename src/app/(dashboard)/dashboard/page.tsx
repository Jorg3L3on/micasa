import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { fetchFromApi } from '@/lib/api-server';
import CreateMonthCard from '@/components/CreateMonthCard';
import type { DashboardData } from '@/types/dashboard';
import DashboardPanel from '@/components/dashboard/DashboardPanel';

export const metadata: Metadata = {
  title: 'Inicio | MiCasa',
  description: 'Resumen de ingresos, gastos y balance por categoría.',
};

async function getDashboardData(
  searchParams: {
    view?: string;
    month?: string;
    year?: string;
    period?: string;
    ownerType?: string;
    ownerId?: string;
  },
): Promise<DashboardData | null> {
  try {
    const query = new URLSearchParams();
    query.set('view', searchParams.view ?? 'biweekly');
    if (searchParams.month) query.set('month', searchParams.month);
    if (searchParams.year) query.set('year', searchParams.year);
    if (searchParams.period) query.set('period', searchParams.period);
    const ownerContext =
      searchParams.ownerType && searchParams.ownerId
        ? {
            ownerType: searchParams.ownerType as 'user' | 'house',
            ownerId: Number(searchParams.ownerId),
          }
        : undefined;
    return await fetchFromApi<DashboardData>(
      `/api/dashboard?${query.toString()}`,
      ownerContext,
    );
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    return null;
  }
}

function buildLegacyPantryRedirectUrl(params: {
  ownerType?: string;
  ownerId?: string;
}): string {
  const query = new URLSearchParams();
  if (params.ownerType) query.set('ownerType', params.ownerType);
  if (params.ownerId) query.set('ownerId', params.ownerId);
  const qs = query.toString();
  return qs ? `/pantry?${qs}` : '/pantry';
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    month?: string;
    year?: string;
    period?: string;
    tab?: string;
    ownerType?: string;
    ownerId?: string;
  }>;
}) {
  const params = await searchParams;

  if (params.tab === 'despensa') {
    redirect(buildLegacyPantryRedirectUrl(params));
  }

  const dashboardData = await getDashboardData(params);

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <p className="text-destructive">
          No se pudo cargar el panel. Revisa la conexión e intenta de nuevo.
        </p>
        <CreateMonthCard />
      </div>
    );
  }

  return <DashboardPanel data={dashboardData} />;
}
