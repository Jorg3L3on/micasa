'use client';

import {
  Suspense,
  useCallback,
  useId,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, useReducedMotion, type Transition } from 'framer-motion';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';

import { getDockDestinations } from '@/components/nav-destinations';
import { useSidebar } from '@/components/ui/sidebar';
import { DOCK_FLOAT_PADDING_CLASS } from '@/lib/ui/dock-clearance';
import { cn } from '@/lib/utils';

const PILL_SPRING: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 32,
  mass: 0.6,
};

export const MOBILE_DOCK_SHELL_CLASS = cn(
  'relative grid h-(--dock-bar-height) grid-cols-4 items-center overflow-hidden rounded-full',
  'border border-black/10 bg-background/70 shadow-panel',
  'supports-[backdrop-filter]:bg-background/45 backdrop-blur-2xl backdrop-saturate-180',
  'dark:border-white/[0.12] dark:bg-[rgb(9_14_29/0.6)] dark:supports-[backdrop-filter]:bg-[rgb(9_14_29/0.4)] dark:shadow-panel',
  'before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-black/20 before:to-transparent',
  'dark:before:via-white/40',
);

type DockTab = {
  title: string;
  href: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

const getDockTabs = (): DockTab[] =>
  getDockDestinations().map((destination) => ({
    title: destination.dockTitle ?? destination.title,
    href: destination.getHref(),
    icon: destination.icon,
    isActive: destination.isActive,
  }));

const DOCK_ITEM_ACTIVE_CLASS = 'text-foreground';
const DOCK_ITEM_IDLE_CLASS = 'text-muted-foreground hover:text-foreground';

const hrefWithOwnerParams = (url: string, queryString: string) =>
  queryString ? `${url}?${queryString}` : url;

type DockTabLinkProps = {
  title: string;
  href: string;
  icon: LucideIcon;
  active: boolean;
  layoutId: string;
  reduceMotion: boolean | null;
};

const DockTabLink = ({
  title,
  href,
  icon: Icon,
  active,
  layoutId,
  reduceMotion,
}: DockTabLinkProps) => {
  return (
    <motion.div
      className="relative isolate flex min-w-0 flex-1"
      whileTap={reduceMotion ? undefined : { scale: 0.92 }}
    >
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        aria-label={title}
        className={cn(
          'relative z-0 flex h-14 min-h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-caption font-medium transition-colors',
          active ? DOCK_ITEM_ACTIVE_CLASS : DOCK_ITEM_IDLE_CLASS,
        )}
      >
        {active ? (
          <motion.span
            layoutId={layoutId}
            className="absolute inset-1 -z-10 rounded-full liquid-glass liquid-glass-pill"
            transition={reduceMotion ? { duration: 0 } : PILL_SPRING}
            aria-hidden
          />
        ) : null}
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        <span
          className={cn(
            'max-w-full text-center leading-none tracking-tight transition-opacity',
            active ? 'opacity-100' : 'opacity-60',
          )}
        >
          {title}
        </span>
      </Link>
    </motion.div>
  );
};

function MobileBottomDockInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setOpenMobile } = useSidebar();
  const reduceMotion = useReducedMotion();
  const pillLayoutId = useId();

  const ownerParams = new URLSearchParams();
  const ownerType = searchParams.get('ownerType');
  const ownerId = searchParams.get('ownerId');
  if (ownerType) ownerParams.set('ownerType', ownerType);
  if (ownerId) ownerParams.set('ownerId', ownerId);
  const queryString = ownerParams.toString();

  const tabs = getDockTabs();
  const activeTab = tabs.find((tab) => tab.isActive(pathname));
  const moreActive = !activeTab;

  const handleOpenMore = useCallback(() => {
    setOpenMobile(true);
  }, [setOpenMobile]);

  const handleMoreKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpenMore();
    }
  };

  return (
    <nav
      aria-label="Navegación principal"
      data-testid="mobile-bottom-dock"
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 md:hidden',
        DOCK_FLOAT_PADDING_CLASS,
      )}
    >
      <div className="pointer-events-auto relative mx-auto max-w-lg">
        <div className={MOBILE_DOCK_SHELL_CLASS}>
          <DockTabLink
            title={tabs[0].title}
            href={hrefWithOwnerParams(tabs[0].href, queryString)}
            icon={tabs[0].icon}
            active={tabs[0].isActive(pathname)}
            layoutId={pillLayoutId}
            reduceMotion={reduceMotion}
          />
          <DockTabLink
            title={tabs[1].title}
            href={hrefWithOwnerParams(tabs[1].href, queryString)}
            icon={tabs[1].icon}
            active={tabs[1].isActive(pathname)}
            layoutId={pillLayoutId}
            reduceMotion={reduceMotion}
          />
          <DockTabLink
            title={tabs[2].title}
            href={hrefWithOwnerParams(tabs[2].href, queryString)}
            icon={tabs[2].icon}
            active={tabs[2].isActive(pathname)}
            layoutId={pillLayoutId}
            reduceMotion={reduceMotion}
          />

          <motion.div
            className="relative isolate flex min-w-0 flex-1"
            whileTap={reduceMotion ? undefined : { scale: 0.92 }}
          >
            <button
              type="button"
              aria-label="Más opciones de navegación"
              tabIndex={0}
              onClick={handleOpenMore}
              onKeyDown={handleMoreKeyDown}
              className={cn(
                'relative z-0 flex h-14 min-h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-caption font-medium transition-colors',
                moreActive ? DOCK_ITEM_ACTIVE_CLASS : DOCK_ITEM_IDLE_CLASS,
              )}
            >
              {moreActive ? (
                <motion.span
                  layoutId={pillLayoutId}
                  className="absolute inset-1 -z-10 rounded-full liquid-glass liquid-glass-pill"
                  transition={reduceMotion ? { duration: 0 } : PILL_SPRING}
                  aria-hidden
                />
              ) : null}
              <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden />
              <span
                className={cn(
                  'max-w-full text-center leading-none tracking-tight transition-opacity',
                  moreActive ? 'opacity-100' : 'opacity-60',
                )}
              >
                Más
              </span>
            </button>
          </motion.div>
        </div>
      </div>
    </nav>
  );
}

export function MobileBottomDock() {
  return (
    <Suspense fallback={null}>
      <MobileBottomDockInner />
    </Suspense>
  );
}
