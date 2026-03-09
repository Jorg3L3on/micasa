import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { fetchFromApi } from '@/lib/api-server';
import CreateMonthCard from '@/components/CreateMonthCard';
import { DashboardTabs } from '@/components/dashboard';
import type { DashboardData } from '@/types/dashboard';

export const metadata: Metadata = {
  title: 'Panel | MiCasa',
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
    if (searchParams.view) query.set('view', searchParams.view);
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

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    month?: string;
    year?: string;
    period?: string;
    ownerType?: string;
    ownerId?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = Number(session.user.id);
  const wallet = await prisma.wallet.findFirst({
    where: {
      user_id: userId,
      house_id: null,
    },
  });

  if (!wallet) {
    redirect('/onboarding');
  }

  const params = await searchParams;
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

  return (
    <>
      <DashboardTabs data={dashboardData} />
    </>
  );
}
