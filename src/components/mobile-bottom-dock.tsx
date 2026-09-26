'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from 'framer-motion';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Calendar,
  ChartLine,
  MoreHorizontal,
  Plus,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { useOptionalQuickCapture } from '@/components/quick-capture/QuickCaptureHost';
import { useSidebar } from '@/components/ui/sidebar';
import { getCurrentMonthlyPanelHref } from '@/lib/fortnight-calendar';
import { cn } from '@/lib/utils';

const PILL_SPRING: Transition = {
  type: 'spring',
  stiffness: 360,
  damping: 32,
  mass: 0.6,
};

const MENU_TRANSITION: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 28,
  mass: 0.7,
};

export const MOBILE_DOCK_SHELL_CLASS = cn(
  'relative grid h-16 grid-cols-5 items-center overflow-hidden rounded-full',
  'border border-black/10 bg-background/80 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)]',
  'supports-[backdrop-filter]:bg-background/70 backdrop-blur-2xl backdrop-saturate-150',
  'dark:border-white/10 dark:bg-[rgb(9_14_29/0.72)] dark:shadow-[0_18px_40px_-22px_rgba(0,0,0,0.72),0_32px_80px_-36px_rgba(58,55,252,0.16)]',
  'before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-black/20 before:to-transparent',
  'dark:before:via-white/40',
);

type DockTab = {
  title: string;
  href: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

const getDockTabs = (): DockTab[] => [
  {
    title: 'Panel',
    href: getCurrentMonthlyPanelHref(),
    icon: Calendar,
    isActive: (path) => path.startsWith('/monthly/'),
  },
  {
    title: 'Billeteras',
    href: '/wallets',
    icon: Wallet,
    isActive: (path) =>
      path === '/wallets' ||
      (path.startsWith('/wallets/') && !path.startsWith('/wallets/liquidity')) ||
      path.startsWith('/credit-cards'),
  },
  {
    title: 'Análisis',
    href: '/wallets/liquidity',
    icon: ChartLine,
    isActive: (path) => path.startsWith('/wallets/liquidity'),
  },
];

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
          'relative z-0 flex h-14 min-h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors',
          active
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {active ? (
          <motion.span
            layoutId={layoutId}
            className="absolute inset-1 -z-10 rounded-full bg-black/5 ring-1 ring-black/10 dark:bg-white/10 dark:ring-white/15"
            transition={reduceMotion ? { duration: 0 } : PILL_SPRING}
            aria-hidden
          />
        ) : null}
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        <span
          className={cn(
            'max-w-full truncate transition-opacity',
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
  const quickCapture = useOptionalQuickCapture();
  const reduceMotion = useReducedMotion();
  const pillLayoutId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);

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
    setMenuOpen(false);
    setOpenMobile(true);
  }, [setOpenMobile]);

  const handleToggleMenu = useCallback(() => {
    setMenuOpen((open) => !open);
  }, []);

  const handleChooseExpense = useCallback(() => {
    setMenuOpen(false);
    quickCapture?.openExpense();
  }, [quickCapture]);

  const handleChooseIncome = useCallback(() => {
    setMenuOpen(false);
    quickCapture?.openIncome();
  }, [quickCapture]);

  const handleMoreKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleOpenMore();
    }
  };

  const handlePlusKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggleMenu();
    }
  };

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (plusRef.current?.contains(target)) return;
      setMenuOpen(false);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav
      aria-label="Navegación principal"
      data-testid="mobile-bottom-dock"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:hidden"
    >
      <div className="pointer-events-auto relative mx-auto max-w-lg">
        <AnimatePresence>
          {menuOpen ? (
            <motion.div
              ref={menuRef}
              role="menu"
              aria-label="Agregar gasto o ingreso"
              initial={
                reduceMotion
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.92, y: 8 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.92, y: 8 }
              }
              transition={reduceMotion ? { duration: 0 } : MENU_TRANSITION}
              className={cn(
                'absolute bottom-[calc(100%+0.75rem)] left-1/2 z-10 w-[min(17.5rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-2xl',
                'border border-black/10 bg-background/90 p-1.5 shadow-[0_16px_40px_-18px_rgba(15,23,42,0.4)]',
                'supports-[backdrop-filter]:bg-background/80 backdrop-blur-2xl backdrop-saturate-150',
                'dark:border-white/10 dark:bg-[rgb(9_14_29/0.88)] dark:shadow-[0_18px_40px_-22px_rgba(0,0,0,0.72)]',
              )}
            >
              <button
                type="button"
                role="menuitem"
                aria-label="Agregar gasto"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={handleChooseExpense}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 ring-1 ring-violet-500/25">
                  <ArrowDownCircle
                    className="h-4 w-4 text-violet-600 dark:text-violet-400"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Gasto</span>
                  <span className="block text-xs text-muted-foreground">
                    Planificar o marcar como pagado
                  </span>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                aria-label="Agregar ingreso"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onClick={handleChooseIncome}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 ring-1 ring-blue-500/25">
                  <ArrowUpCircle
                    className="h-4 w-4 text-blue-600 dark:text-blue-400"
                    aria-hidden
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Ingreso</span>
                  <span className="block text-xs text-muted-foreground">
                    Solo esta quincena
                  </span>
                </span>
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>

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

          <div className="relative flex min-w-0 flex-1 items-center justify-center">
            <motion.button
              ref={plusRef}
              type="button"
              aria-label="Agregar gasto o ingreso"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              tabIndex={0}
              onClick={handleToggleMenu}
              onKeyDown={handlePlusKeyDown}
              whileTap={reduceMotion ? undefined : { scale: 0.9 }}
              className={cn(
                'flex size-12 items-center justify-center rounded-full bg-primary text-white shadow-md',
                'ring-2 ring-primary/30 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                'dark:bg-[#3a37fc]',
              )}
            >
              <motion.span
                animate={{ rotate: menuOpen ? 45 : 0 }}
                transition={reduceMotion ? { duration: 0 } : PILL_SPRING}
                className="flex"
              >
                <Plus className="h-6 w-6" aria-hidden />
              </motion.span>
            </motion.button>
          </div>

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
                'relative z-0 flex h-14 min-h-11 w-full min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors',
                moreActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {moreActive ? (
                <motion.span
                  layoutId={pillLayoutId}
                  className="absolute inset-1 -z-10 rounded-full bg-black/5 ring-1 ring-black/10 dark:bg-white/10 dark:ring-white/15"
                  transition={reduceMotion ? { duration: 0 } : PILL_SPRING}
                  aria-hidden
                />
              ) : null}
              <MoreHorizontal className="h-5 w-5 shrink-0" aria-hidden />
              <span
                className={cn(
                  'max-w-full truncate transition-opacity',
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
