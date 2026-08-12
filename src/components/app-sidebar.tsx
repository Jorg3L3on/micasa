'use client';

import * as React from 'react';
import { Suspense } from 'react';
import {
  ChartLine,
  ClipboardList,
  FolderTree,
  Receipt,
  Calendar,
  Coins,
  Goal,
  HandCoins,
  Home,
  PiggyBank,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';

import { TeamSwitcher } from '@/components/team-switcher';
import { NavUser } from '@/components/nav-user';
import { NavMain } from '@/components/nav-main';
import { useFinanceContext } from '@/context/finance-context';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { getCurrentMonthlyPanelHref } from '@/lib/fortnight-calendar';

/** Cierra el drawer en móvil al cambiar ruta o query (p. ej. contexto de casa). */
function MobileSidebarCloseOnRouteInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const { isMobile, setOpenMobile } = useSidebar();

  React.useEffect(() => {
    if (!isMobile) return;
    setOpenMobile(false);
  }, [pathname, searchKey, isMobile, setOpenMobile]);

  return null;
}

function MobileSidebarCloseOnRoute() {
  return (
    <Suspense
      fallback={
        <span className="sr-only" role="status">
          Cargando navegación…
        </span>
      }
    >
      <MobileSidebarCloseOnRouteInner />
    </Suspense>
  );
}

export type AppSidebarNavUser = {
  name: string;
  email: string;
  avatar: string;
};

export function AppSidebar({
  navUser,
  ...props
}: React.ComponentProps<typeof Sidebar> & { navUser: AppSidebarNavUser }) {
  const pathname = usePathname();
  const { context } = useFinanceContext();

  const menuItems = [
    {
      title: 'Panel financiero',
      url: getCurrentMonthlyPanelHref(),
      icon: Calendar,
      isActive: pathname.startsWith('/monthly/'),
    },
    {
      title: 'Billeteras',
      url: '/wallets',
      icon: Wallet,
      isActive:
        pathname === '/wallets' ||
        (pathname.startsWith('/wallets/') &&
          !pathname.startsWith('/wallets/liquidity')) ||
        pathname.startsWith('/credit-cards'),
    },
    {
      title: 'Metas',
      url: '/metas',
      icon: Goal,
      isActive: pathname === '/metas' || pathname.startsWith('/metas/'),
    },
    {
      title: 'Gastos',
      url: '/expenses',
      icon: Coins,
      isActive: pathname === '/expenses' || pathname.startsWith('/expenses/'),
    },
    {
      title: 'Préstamos',
      url: '/loans',
      icon: HandCoins,
      isActive: pathname === '/loans' || pathname.startsWith('/loans/'),
    },
    {
      title: 'Operaciones',
      url: '/transactions',
      icon: Receipt,
      isActive:
        pathname === '/transactions' || pathname.startsWith('/transactions/'),
    },
    {
      title: 'Presupuestos',
      url: '/budgets',
      icon: PiggyBank,
      isActive: pathname === '/budgets' || pathname.startsWith('/budgets/'),
    },
  ];

  const catalogItems = [
    {
      title: 'Categorías',
      url: '/categories',
      icon: FolderTree,
      isActive: pathname.startsWith('/categories'),
    },
    {
      title: 'Gastos programados',
      url: '/expense-templates',
      icon: ClipboardList,
      isActive: pathname.startsWith('/expense-templates'),
    },
    {
      title: 'Ingresos programados',
      url: '/income-templates',
      icon: TrendingUp,
      isActive: pathname.startsWith('/income-templates'),
    },
    {
      title: 'Liquidez y análisis',
      url: '/wallets/liquidity',
      icon: ChartLine,
      isActive: pathname.startsWith('/wallets/liquidity'),
    },
    ...(context.type === 'house'
      ? [
          {
            title: 'Usuarios de la casa',
            url: '/house-users',
            icon: Users,
            isActive: pathname.startsWith('/house-users'),
          },
        ]
      : []),
  ];

  const teams = [
    {
      name: 'MiCasa',
      logo: Home,
      plan: 'Gestión Financiera',
    },
  ];

  return (
    <>
      <MobileSidebarCloseOnRoute />
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <TeamSwitcher teams={teams} />
        </SidebarHeader>
        <SidebarContent>
          <NavMain groupLabel="Menú" items={menuItems} />
          <NavMain groupLabel="Catálogos" items={catalogItems} />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={navUser} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </>
  );
}
