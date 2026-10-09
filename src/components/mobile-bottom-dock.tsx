'use client';

import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { MoreHorizontal } from 'lucide-react';

import {
  getMobileDockItems,
  getOverflowDestinations,
} from '@/components/nav-destinations';
import {
  NAV_PILL_SHELL_CLASS,
  NavPillButton,
  NavPillLink,
  hrefWithOwnerQuery,
  useNavOwnerQuery,
} from '@/components/nav-pill';
import { useSidebar } from '@/components/ui/sidebar';
import { DOCK_FLOAT_PADDING_CLASS } from '@/lib/ui/dock-clearance';
import { cn } from '@/lib/utils';

const MobileBottomDockInner = () => {
  const pathname = usePathname();
  const ownerQuery = useNavOwnerQuery();
  const { openMobile, setOpenMobile } = useSidebar();

  const items = getMobileDockItems();
  const moreActive = getOverflowDestinations().some((destination) =>
    destination.isActive(pathname),
  );

  return (
    <nav
      aria-label="Navegación principal"
      data-testid="mobile-bottom-dock"
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 md:hidden',
        DOCK_FLOAT_PADDING_CLASS,
      )}
    >
      <div className="pointer-events-auto mx-auto max-w-lg">
        <div
          className={cn(
            NAV_PILL_SHELL_CLASS,
            'h-(--dock-bar-height) w-full flex-row items-stretch gap-0 px-1',
          )}
        >
          {items.map((item) => (
            <NavPillLink
              key={item.id}
              href={hrefWithOwnerQuery(item.getHref(), ownerQuery)}
              label={item.title}
              icon={item.icon}
              active={item.isActive(pathname)}
              tooltipSide="top"
              layout="slot"
            />
          ))}
          <NavPillButton
            label="Más opciones de navegación"
            icon={MoreHorizontal}
            active={moreActive}
            tooltipSide="top"
            layout="slot"
            expanded={openMobile}
            onClick={() => setOpenMobile(true)}
          />
        </div>
      </div>
    </nav>
  );
};

export const MobileBottomDock = () => (
  <Suspense fallback={null}>
    <MobileBottomDockInner />
  </Suspense>
);
