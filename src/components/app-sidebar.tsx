'use client';

import * as React from 'react';
import { Suspense } from 'react';
import {
  LayoutDashboard,
  FolderTree,
  Receipt,
  Calendar,
  Coins,
  CheckSquare,
  ListChecks,
  Repeat2,
  Sparkles,
  Home,
  PiggyBank,
  ShoppingBasket,
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
    <Suspense fallback={null}>
      <MobileSidebarCloseOnRouteInner />
    </Suspense>
  );
}

/** Mes calendario en UTC (misma fecha en Node SSR y en el navegador para el mismo instante). */
function getCurrentMonthHrefUtc(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `/monthly/${year}/${month}`;
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

  const catalogItems = [
    {
      title: 'Plantillas de gastos',
      url: '/expense-templates',
      isActive: pathname.startsWith('/expense-templates'),
    },
    {
      title: 'Plantillas de ingresos',
      url: '/income-templates',
      isActive: pathname.startsWith('/income-templates'),
    },
    {
      title: 'Plantillas de presupuestos',
      url: '/budget-templates',
      isActive: pathname.startsWith('/budget-templates'),
    },
    {
      title: 'Categorías',
      url: '/categories',
      isActive: pathname.startsWith('/categories'),
    },
    {
      title: 'Liquidez y análisis',
      url: '/wallets/liquidity',
      isActive: pathname.startsWith('/wallets/liquidity'),
    },
    ...(context.type === 'house'
      ? [
          {
            title: 'Usuarios de la casa',
            url: '/house-users',
            isActive: pathname.startsWith('/house-users'),
          },
        ]
      : []),
  ];

  const menuItems = [
    {
      title: 'Panel',
      url: '/dashboard',
      icon: LayoutDashboard,
      isActive: pathname === '/dashboard' || pathname.startsWith('/dashboard/'),
    },
    {
      title: 'Gastos',
      url: '/expenses',
      icon: Coins,
      isActive: pathname === '/expenses' || pathname.startsWith('/expenses/'),
    },
    {
      title: 'Panel financiero',
      url: getCurrentMonthHrefUtc(),
      icon: Calendar,
      isActive: pathname.startsWith('/monthly/'),
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
      title: 'Lista de compras',
      url: '/pantry/shopping',
      icon: ShoppingBasket,
      isActive: pathname.startsWith('/pantry/shopping'),
    },
  ];

  const generalItems = [
    {
      title: 'Catálogos',
      url: '#',
      icon: FolderTree,
      isActive:
        pathname.startsWith('/expense-templates') ||
        pathname.startsWith('/income-templates') ||
        pathname.startsWith('/budget-templates') ||
        pathname.startsWith('/categories') ||
        pathname.startsWith('/wallets/liquidity') ||
        pathname.startsWith('/house-users'),
      items: catalogItems,
    },
    {
      title: 'Despensa',
      url: '#',
      icon: ShoppingBasket,
      isActive:
        pathname.startsWith('/pantry/receipts') ||
        pathname.startsWith('/pantry/products'),
      items: [
        {
          title: 'Recibos',
          url: '/pantry/receipts',
          isActive: pathname.startsWith('/pantry/receipts'),
        },
        {
          title: 'Productos',
          url: '/pantry/products',
          isActive: pathname.startsWith('/pantry/products'),
        },
      ],
    },
    {
      title: 'Tareas',
      url: '#',
      icon: CheckSquare,
      isActive: pathname.startsWith('/tasks'),
      items: [
        {
          title: 'Hoy',
          url: '/tasks',
          isActive: pathname === '/tasks',
        },
        {
          title: 'Listas de tareas',
          url: '/tasks/todo-lists',
          isActive:
            pathname.startsWith('/tasks/todo-lists') ||
            pathname.startsWith('/tasks/lists/'),
        },
        {
          title: 'Tareas programadas',
          url: '/tasks/scheduled',
          isActive: pathname.startsWith('/tasks/scheduled'),
        },
        {
          title: 'Hábitos',
          url: '/tasks/habits',
          isActive: pathname.startsWith('/tasks/habits'),
        },
        {
          title: 'Rutinas diarias',
          url: '/tasks/routines',
          isActive: pathname.startsWith('/tasks/routines'),
        },
      ],
    },
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
          <NavMain groupLabel="General" items={generalItems} />
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={navUser} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </>
  );
}
