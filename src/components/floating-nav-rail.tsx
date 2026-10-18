'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';

import { AlertsBell } from '@/components/AlertsBell';
import { NAV_DESTINATIONS } from '@/components/nav-destinations';
import {
  NAV_PILL_SHELL_CLASS,
  NavPillLink,
  hrefWithOwnerQuery,
  navPillIconClass,
  useNavOwnerQuery,
} from '@/components/nav-pill';
import { ThemeToggle } from '@/components/theme-toggle';
import { useSidebar } from '@/components/ui/sidebar';
import { useClientMounted } from '@/hooks/use-client-mounted';
import { cn } from '@/lib/utils';

const RAIL_ICON_CLASS = navPillIconClass(false);

const RAIL_GROUP_CLASS = cn(
  NAV_PILL_SHELL_CLASS,
  'pointer-events-auto flex-col',
);

const RailFallback = () => (
  <>
    <div aria-hidden />
    <div className={cn(RAIL_GROUP_CLASS, 'self-center')} aria-hidden>
      {NAV_DESTINATIONS.map((destination) => (
        <span
          key={destination.id}
          className="size-10 animate-pulse rounded-full bg-muted"
        />
      ))}
    </div>
    <div className={cn(RAIL_GROUP_CLASS, 'self-end')} aria-hidden>
      <span className="size-10 animate-pulse rounded-full bg-muted" />
      <span className="size-10 animate-pulse rounded-full bg-muted" />
    </div>
  </>
);

/** Nav group centered and theme/alerts pinned to the bottom (grid rows in FloatingNavRail). */
const FloatingNavRailInner = () => {
  const pathname = usePathname();
  const ownerQuery = useNavOwnerQuery();

  return (
    <>
      {/* Empty first row keeps the nav group centered (house switcher lives in the header). */}
      <div aria-hidden />

      <div className={cn(RAIL_GROUP_CLASS, 'self-center')}>
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

      <div className={cn(RAIL_GROUP_CLASS, 'self-end')}>
        <ThemeToggle className={RAIL_ICON_CLASS} />
        <AlertsBell className={RAIL_ICON_CLASS} />
      </div>
    </>
  );
};

/**
 * Desktop icon rail: two floating pills (middle, bottom) on the canvas.
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
      className="pointer-events-none fixed inset-y-0 left-3 z-40 hidden w-14 md:block"
    >
      {/* No overflow clipping here: it would crop the pill shadows into a tinted band. */}
      <div className="grid h-full w-full grid-rows-[1fr_auto_1fr] justify-items-center pb-4 pt-[calc(4rem+env(safe-area-inset-top)+0.75rem)]">
        <Suspense fallback={<RailFallback />}>
          <FloatingNavRailInner />
        </Suspense>
      </div>
    </nav>
  );
};
