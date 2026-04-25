'use client';

import * as React from 'react';
import {
  LayoutDashboard,
  FolderTree,
  Receipt,
  Calendar,
  Coins,
  Home,
  PiggyBank,
  ShoppingBasket,
  Wallet,
} from 'lucide-react';
import { usePathname } from 'next/navigation';

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
} from '@/components/ui/sidebar';

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
      title: 'Categorías',
      url: '/categories',
      isActive: pathname.startsWith('/categories'),
    },
    {
      title: 'Proyección de liquidez',
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
      title: 'Planificación',
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
  ];

  const generalItems = [
    {
      title: 'Catálogos',
      url: '#',
      icon: FolderTree,
      isActive:
        pathname.startsWith('/expense-templates') ||
        pathname.startsWith('/income-templates') ||
        pathname.startsWith('/categories') ||
        pathname.startsWith('/wallets/liquidity') ||
        pathname.startsWith('/house-users'),
      items: catalogItems,
    },
    {
      title: 'Despensa',
      url: '#',
      icon: ShoppingBasket,
      isActive: pathname.startsWith('/pantry'),
      items: [
        {
          title: 'Inicio',
          url: '/pantry',
          isActive:
            pathname === '/pantry' ||
            (pathname.startsWith('/pantry') &&
              !pathname.startsWith('/pantry/receipts') &&
              !pathname.startsWith('/pantry/products') &&
              !pathname.startsWith('/pantry/shopping')),
        },
        {
          title: 'Lista de compras',
          url: '/pantry/shopping',
          isActive: pathname.startsWith('/pantry/shopping'),
        },
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
  ];

  const teams = [
    {
      name: 'MiCasa',
      logo: Home,
      plan: 'Gestión Financiera',
    },
  ];

  return (
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
  );
}
