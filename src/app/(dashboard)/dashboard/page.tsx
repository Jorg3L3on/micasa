import type { Metadata } from 'next';
import { fetchFromApi } from '@/lib/api-server';
import CreateMonthCard from '@/components/CreateMonthCard';
import type { DashboardData } from '@/types/dashboard';
import StatCard from '@/components/dashboard/StatCard';
import MonthlyOverviewChart from '@/components/dashboard/MonthlyOverviewChart';
import MyCardsPanel from '@/components/dashboard/MyCardsPanel';
import RecentTransactionsTable from '@/components/dashboard/RecentTransactionsTable';

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

const STAT_CARDS = [
  {
    key: 'balance' as const,
    title: 'Balance total',
    iconKey: 'wallet' as const,
    iconGradient: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
    subtitle: 'Saldo en billeteras',
  },
  {
    key: 'income' as const,
    title: 'Ingresos del periodo',
    iconKey: 'trending-up' as const,
    iconGradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    subtitle: 'Total ingresado',
  },
  {
    key: 'expense' as const,
    title: 'Gastos del periodo',
    iconKey: 'trending-down' as const,
    iconGradient: 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
    subtitle: 'Total gastado',
  },
  {
    key: 'available' as const,
    title: 'Disponible',
    iconKey: 'circle-dollar' as const,
    iconGradient: 'linear-gradient(135deg, #eab308 0%, #facc15 100%)',
    subtitle: 'Libre de compromisos',
  },
] as const;

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

  const { summary, availableVsCommitted } = dashboardData;

  const statValues = {
    balance: summary.balance,
    income: summary.totalIncome,
    expense: summary.totalExpense,
    available: availableVsCommitted.libre,
  };

  return (
    <div className="space-y-5">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map((card) => (
          <StatCard
            key={card.key}
            title={card.title}
            amount={statValues[card.key]}
            iconKey={card.iconKey}
            iconGradient={card.iconGradient}
            subtitle={card.subtitle}
          />
        ))}
      </div>

      {/* Chart + Cards row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MonthlyOverviewChart />
        </div>
        <div className="lg:col-span-2">
          <MyCardsPanel />
        </div>
      </div>

      {/* Recent transactions */}
      <RecentTransactionsTable data={dashboardData} />
    </div>
  );
}
