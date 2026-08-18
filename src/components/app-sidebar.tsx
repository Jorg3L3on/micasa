'use client';

import * as React from 'react';
import { Suspense } from 'react';
import {
  ChartLine,
  Receipt,
  Calendar,
  Coins,
  Goal,
  HandCoins,
  PiggyBank,
  Wallet,
} from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';

import { TeamSwitcher } from '@/components/team-switcher';
import { NavMain } from '@/components/nav-main';
import { MicasaMark } from '@/components/brand/micasa-mark';
import {
  Sidebar,
  SidebarContent,
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

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

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
      title: 'Liquidez y análisis',
      url: '/wallets/liquidity',
      icon: ChartLine,
      isActive: pathname.startsWith('/wallets/liquidity'),
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

  return (
    <>
      <MobileSidebarCloseOnRoute />
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader className="gap-3">
          <div className="flex items-center gap-2 px-2 pt-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
            <MicasaMark className="h-6 w-auto" />
            <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
              MiCasa
            </span>
          </div>
          <TeamSwitcher />
        </SidebarHeader>
        <SidebarContent>
          <NavMain groupLabel="Menú" items={menuItems} />
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
    </>
  );
}
