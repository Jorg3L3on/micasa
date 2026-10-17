'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { UserRound } from 'lucide-react';

import { AlertsBell } from '@/components/AlertsBell';
import { NavMain, type NavMainItem } from '@/components/nav-main';
import { getOverflowDestinations } from '@/components/nav-destinations';
import { TeamSwitcher, TeamSwitcherShell } from '@/components/team-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from '@/components/ui/sidebar';

const MobileOverflowNavInner = () => {
  const pathname = usePathname();

  const accountPath = '/settings/account';
  const items: NavMainItem[] = [
    ...getOverflowDestinations().map((destination) => ({
      title: destination.title,
      url: destination.getHref(),
      icon: destination.icon,
      isActive: destination.isActive(pathname),
    })),
    {
      title: 'Cuenta',
      url: accountPath,
      icon: UserRound,
      isActive: pathname === accountPath,
    },
  ];

  return (
    <>
      <SidebarHeader className="gap-3">
        <Suspense fallback={<TeamSwitcherShell />}>
          <TeamSwitcher />
        </Suspense>
      </SidebarHeader>
      <SidebarContent>
        <NavMain groupLabel="" items={items} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border py-3">
        <div className="flex items-center justify-around px-1">
          <div className="flex flex-col items-center gap-1">
            <AlertsBell />
            <span className="text-caption text-muted-foreground">Alertas</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ThemeToggle />
            <span className="text-caption text-muted-foreground">Tema</span>
          </div>
        </div>
      </SidebarFooter>
    </>
  );
};

/** Mobile sheet: destinations that are not in the dock, plus account chrome, alerts and theme. */
export const MobileOverflowNav = () => (
  <Suspense
    fallback={
      <span className="sr-only" role="status">
        Cargando navegación…
      </span>
    }
  >
    <MobileOverflowNavInner />
  </Suspense>
);
