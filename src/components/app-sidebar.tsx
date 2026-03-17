'use client';

import * as React from 'react';
import {
  LayoutDashboard,
  FolderTree,
  Receipt,
  Calendar,
  Home,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

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

function getCurrentMonthHref(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `/monthly/${year}/${month}`;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: session } = useSession();
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
      title: 'Billeteras',
      url: '/wallets',
      isActive:
        pathname.startsWith('/wallets') ||
        pathname.startsWith('/credit-cards'),
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

  const navItems = [
    {
      title: 'Panel',
      url: '/dashboard',
      icon: LayoutDashboard,
      isActive: pathname === '/dashboard' || pathname.startsWith('/dashboard/'),
    },
    {
      title: 'Planificación',
      url: getCurrentMonthHref(),
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
      title: 'Catálogos',
      url: '#',
      icon: FolderTree,
      isActive:
        pathname.startsWith('/expense-templates') ||
        pathname.startsWith('/income-templates') ||
        pathname.startsWith('/categories') ||
        pathname.startsWith('/wallets') ||
        pathname.startsWith('/credit-cards') ||
        pathname.startsWith('/house-users'),
      items: catalogItems,
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
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: session?.user?.name ?? 'Usuario',
            email: session?.user?.email ?? '',
            avatar: session?.user?.image ?? '',
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
