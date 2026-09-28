'use client';

import * as React from 'react';
import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { TeamSwitcher, TeamSwitcherShell } from '@/components/team-switcher';
import { NavMain, type NavMainItem } from '@/components/nav-main';
import { NAV_DESTINATIONS } from '@/components/nav-destinations';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { AlertsBell } from '@/components/AlertsBell';
import { ThemeToggle } from '@/components/theme-toggle';

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

  const menuItems: NavMainItem[] = NAV_DESTINATIONS.map((destination) => ({
    title: destination.title,
    url: destination.getHref(),
    icon: destination.icon,
    isActive: destination.isActive(pathname),
  }));

  return (
    <>
      <MobileSidebarCloseOnRoute />
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader>
          <Suspense fallback={<TeamSwitcherShell />}>
            <TeamSwitcher />
          </Suspense>
        </SidebarHeader>
        <SidebarContent>
          <NavMain groupLabel="Menú" items={menuItems} />
        </SidebarContent>
        <SidebarFooter className="gap-1 border-t border-sidebar-border">
          <div className="flex items-center justify-between gap-2 px-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center">
            <AlertsBell />
            <ThemeToggle />
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </>
  );
}
