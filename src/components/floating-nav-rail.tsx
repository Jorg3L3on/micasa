'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';

import { AlertsBell } from '@/components/AlertsBell';
import { NavAccountMenu, NavHelpLink } from '@/components/nav-account-menu';
import { NAV_DESTINATIONS } from '@/components/nav-destinations';
import {
  NAV_PILL_SHELL_CLASS,
  NavPillLink,
  hrefWithOwnerQuery,
  navPillIconClass,
  useNavOwnerQuery,
} from '@/components/nav-pill';
import { TeamSwitcher, TeamSwitcherShell } from '@/components/team-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { useSidebar } from '@/components/ui/sidebar';
import { useClientMounted } from '@/hooks/use-client-mounted';
import { cn } from '@/lib/utils';

const RAIL_ICON_CLASS = navPillIconClass(false);

const RailFallback = () => (
  <div className="flex w-full flex-col items-center gap-3" aria-hidden>
    <div className={cn(NAV_PILL_SHELL_CLASS, 'flex-col')}>
      <span className="size-10 animate-pulse rounded-full bg-muted" />
      <span className="size-10 animate-pulse rounded-full bg-muted" />
    </div>
    <div className={cn(NAV_PILL_SHELL_CLASS, 'flex-col')}>
      {NAV_DESTINATIONS.map((destination) => (
        <span
          key={destination.id}
          className="size-10 animate-pulse rounded-full bg-muted"
        />
      ))}
    </div>
    <div className={cn(NAV_PILL_SHELL_CLASS, 'flex-col')}>
      <span className="size-10 animate-pulse rounded-full bg-muted" />
      <span className="size-10 animate-pulse rounded-full bg-muted" />
      <span className="size-10 animate-pulse rounded-full bg-muted" />
    </div>
  </div>
);

const FloatingNavRailInner = () => {
  const pathname = usePathname();
  const ownerQuery = useNavOwnerQuery();

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className={cn(NAV_PILL_SHELL_CLASS, 'flex-col')}>
        <Suspense fallback={<TeamSwitcherShell variant="rail" />}>
          <TeamSwitcher variant="rail" />
        </Suspense>
        <ThemeToggle className={RAIL_ICON_CLASS} />
      </div>

      <div className={cn(NAV_PILL_SHELL_CLASS, 'flex-col')}>
        {NAV_DESTINATIONS.map((destination) => (
          <NavPillLink
            key={destination.id}
            href={hrefWithOwnerQuery(destination.getHref(), ownerQuery)}
            label={destination.title}
            icon={destination.icon}
            active={destination.isActive(pathname)}
            tooltipSide="right"
          />
        ))}
      </div>

      <div className={cn(NAV_PILL_SHELL_CLASS, 'flex-col')}>
        <AlertsBell className={RAIL_ICON_CLASS} />
        <NavHelpLink
          href={hrefWithOwnerQuery('/settings', ownerQuery)}
          tooltipSide="right"
        />
        <NavAccountMenu
          accountHref={hrefWithOwnerQuery('/settings/account', ownerQuery)}
          tooltipSide="right"
        />
      </div>
    </div>
  );
};

/**
 * Desktop icon rail: three floating pills on the canvas.
 * Hidden below `md`. Unmounts after hydration on phones so chrome isn't doubled.
 */
export const FloatingNavRail = () => {
  const { isMobile } = useSidebar();
  const mounted = useClientMounted();
  if (mounted && isMobile) return null;

  return (
    <nav
      aria-label="Navegación principal"
      data-testid="floating-nav-rail"
      className="pointer-events-none fixed inset-y-0 left-3 z-40 hidden w-14 items-center md:flex"
    >
      <div className="pointer-events-auto flex max-h-[calc(100svh-6.5rem)] w-full flex-col items-center overflow-y-auto scrollbar-hide">
        <Suspense fallback={<RailFallback />}>
          <FloatingNavRailInner />
        </Suspense>
      </div>
    </nav>
  );
};
