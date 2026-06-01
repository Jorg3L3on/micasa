import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getDashboardData } from '@/features/dashboard/server/dashboard.service';
import CreateMonthCard from '@/components/CreateMonthCard';
import type { DashboardData, PeriodView } from '@/types/dashboard';
import DashboardPanel from '@/components/dashboard/DashboardPanel';
import { getOwnerContextFromPageSearchParams } from '@/lib/server/get-owner-context';

export const metadata: Metadata = {
  title: 'Inicio | MiCasa',
  description: 'Resumen de ingresos, gastos y balance por categoría.',
};

async function loadDashboardData(
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
    const ctx = await getOwnerContextFromPageSearchParams(searchParams);
    if ('error' in ctx) {
      return null;
    }

    return await getDashboardData({
      ownerFilter: ctx.ownerFilter,
      view: (searchParams.view as PeriodView | undefined) ?? 'biweekly',
      month: searchParams.month ?? null,
      year: searchParams.year ?? null,
      period: (searchParams.period as 'FIRST' | 'SECOND' | undefined) ?? null,
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
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

  const dashboardData = await loadDashboardData(params);

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
