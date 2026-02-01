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
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

import { TeamSwitcher } from '@/components/team-switcher';
import { NavUser } from '@/components/nav-user';
import { NavMain } from '@/components/nav-main';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';
import { clientFetchFromApi } from '@/lib/api';

function getCurrentMonthHref(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `/monthly/${year}/${month}`;
}

type Fortnight = {
  id: number;
  name: string;
  active: boolean;
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [fortnights, setFortnights] = useState<Fortnight[]>([]);
  const [hasActiveFortnight, setHasActiveFortnight] = useState(false);

  useEffect(() => {
    const fetchFortnights = async () => {
      try {
        const data = await clientFetchFromApi<Fortnight[]>('/api/fortnights');
        setFortnights(data);
        setHasActiveFortnight(data.some((f) => f.active));
      } catch (error) {
        console.error('Error fetching fortnights for sidebar:', error);
      }
    };
    fetchFortnights();
  }, []);

  const navItems = [
    {
      title: 'Dashboard',
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
        pathname.startsWith('/expenses') ||
        pathname.startsWith('/fortnights') ||
        pathname.startsWith('/categories') ||
        pathname.startsWith('/payment-methods'),
      items: [
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
          title: 'Gastos',
          url: '/expenses',
          isActive: pathname.startsWith('/expenses'),
        },
        {
          title: 'Quincenas',
          url: '/fortnights',
          isActive: pathname.startsWith('/fortnights'),
        },
        {
          title: 'Categorías',
          url: '/categories',
          isActive: pathname.startsWith('/categories'),
        },
        {
          title: 'Carteras',
          url: '/wallets',
          isActive: pathname.startsWith('/wallets'),
        },
        /**
         * TODO: Delete this view (Deprecated)
         */
        {
          title: 'Métodos de pago',
          url: '/payment-methods',
          isActive: pathname.startsWith('/payment-methods'),
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
