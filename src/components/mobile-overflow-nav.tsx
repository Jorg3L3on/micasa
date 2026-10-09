'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowDownCircle, ArrowUpCircle, CircleHelp, LogOut, UserRound } from 'lucide-react';
import { signOut } from 'next-auth/react';

import { AlertsBell } from '@/components/AlertsBell';
import { NavMain, type NavMainItem } from '@/components/nav-main';
import { getOverflowDestinations } from '@/components/nav-destinations';
import { hrefWithOwnerQuery, useNavOwnerQuery } from '@/components/nav-pill';
import { useOptionalQuickCapture } from '@/components/quick-capture/QuickCaptureHost';
import { TeamSwitcher, TeamSwitcherShell } from '@/components/team-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import {
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';

const sheetRowClass =
  'flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-foreground hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

const MobileOverflowNavInner = () => {
  const pathname = usePathname();
  const ownerQuery = useNavOwnerQuery();
  const { setOpenMobile } = useSidebar();
  const quickCapture = useOptionalQuickCapture();

  const items: NavMainItem[] = getOverflowDestinations().map((destination) => ({
    title: destination.title,
    url: destination.getHref(),
    icon: destination.icon,
    isActive: destination.isActive(pathname),
  }));

  const helpHref = hrefWithOwnerQuery('/settings', ownerQuery);
  const accountHref = hrefWithOwnerQuery('/settings/account', ownerQuery);

  const closeAnd = (action: () => void) => {
    setOpenMobile(false);
    action();
  };

  return (
    <>
      <SidebarHeader className="gap-3">
        <Suspense fallback={<TeamSwitcherShell />}>
          <TeamSwitcher />
        </Suspense>
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
      </SidebarHeader>
      <SidebarContent>
        <NavMain groupLabel="Otras secciones" items={items} />
        <div className="flex flex-col gap-1 px-2">
          <Link href={helpHref} className={sheetRowClass}>
            <CircleHelp className="size-4 text-muted-foreground" aria-hidden />
            Ayuda
          </Link>
          <Link href={accountHref} className={sheetRowClass}>
            <UserRound className="size-4 text-muted-foreground" aria-hidden />
            Cuenta
          </Link>
          <button
            type="button"
            className={sheetRowClass}
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            <LogOut className="size-4 text-destructive" aria-hidden />
            Cerrar sesión
          </button>
        </div>
      </SidebarContent>
      <SidebarFooter className="gap-1 border-t border-sidebar-border">
        <Button
          type="button"
          variant="outline"
          className="h-11 justify-start rounded-xl"
          onClick={() => closeAnd(() => quickCapture?.openExpense())}
        >
          <ArrowDownCircle data-icon="inline-start" />
          Agregar gasto
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 justify-start rounded-xl"
          onClick={() => closeAnd(() => quickCapture?.openIncome())}
        >
          <ArrowUpCircle data-icon="inline-start" />
          Agregar ingreso
        </Button>
      </SidebarFooter>
    </>
  );
};

/** Mobile sheet: destinations that are not in the dock, plus account chrome and quick capture. */
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
