'use client';

import {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useState,
  type FocusEvent,
  type ReactNode,
  type CSSProperties,
} from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, MoreHorizontal, Plus, Search } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import PageTitle, {
  useAppHomeHref,
  useAppPageTitle,
} from '@/components/PageTitle';
import { ToolbarFiltersControl } from '@/components/toolbar-filters-control';
import {
  TOOLBAR_GLASS_CANCEL,
  TOOLBAR_GLASS_FIELD,
  TOOLBAR_GLASS_GROUP,
  TOOLBAR_GLASS_GROUP_DIVIDER,
  TOOLBAR_GLASS_GROUP_ITEM,
  TOOLBAR_GLASS_ICON,
  TOOLBAR_GLASS_SEARCH_PILL,
} from '@/components/toolbar-glass';
import { useToolbarActions } from '@/context/toolbar-actions-context';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery } from '@/lib/api/client-fetch';
import { navigateWithTransitionType } from '@/lib/ui/wallet-card-view-transition';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const takeoverTransition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
};

const TITLE_GAP_PX = 8;

function ToolbarIconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(TOOLBAR_GLASS_ICON, className)}
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/** Header chrome loaded only on the client to avoid Radix hydration mismatches. */
export default function AppHeaderToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const homeHref = useAppHomeHref();
  const { context } = useFinanceContext();
  const { title, showBack } = useAppPageTitle();
  const {
    search,
    filters,
    primaryAction,
    overflow,
    leadingAction,
    searchMode,
    setSearchMode,
  } = useToolbarActions();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchChromeRef = useRef<HTMLDivElement>(null);
  const idleBarRef = useRef<HTMLDivElement>(null);
  const leftClusterRef = useRef<HTMLDivElement>(null);
  const rightClusterRef = useRef<HTMLDivElement>(null);
  const [titleStyle, setTitleStyle] = useState<CSSProperties>({
    left: '50%',
    maxWidth: '40%',
  });

  const searchActive = Boolean(search && searchMode);

  /**
   * Hierarchical hub details: push the list with nav-back (not history.back)
   * so DirectionalTransition (and card morph where used) run.
   * - Billeteras: `/wallets/[id]` or `/credit-cards/[id]` → `/wallets`
   * - Metas: `/metas/[id]` → `/metas`
   */
  const hierarchicalBackHref = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);
    const q = buildOwnerQuery(context).toString();
    const withOwner = (path: string) => (q ? `${path}?${q}` : path);

    if (segments[0] === 'credit-cards' && Boolean(segments[1])) {
      return withOwner('/wallets');
    }
    if (
      segments[0] === 'wallets' &&
      Boolean(segments[1]) &&
      segments[1] !== 'liquidity'
    ) {
      return withOwner('/wallets');
    }
    if (segments[0] === 'metas' && Boolean(segments[1])) {
      return withOwner('/metas');
    }
    return null;
  }, [pathname, context]);

  const updateTitlePosition = useCallback(() => {
    const bar = idleBarRef.current;
    const left = leftClusterRef.current;
    const right = rightClusterRef.current;
    if (!bar || !left || !right) return;

    const barRect = bar.getBoundingClientRect();
    const leftRect = left.getBoundingClientRect();
    const rightRect = right.getBoundingClientRect();

    const start = leftRect.right - barRect.left + TITLE_GAP_PX;
    const end = rightRect.left - barRect.left - TITLE_GAP_PX;
    const maxWidth = Math.max(0, end - start);
    const center = start + maxWidth / 2;

    setTitleStyle({
      left: center,
      maxWidth,
    });
  }, []);

  useLayoutEffect(() => {
    if (searchActive) return;
    updateTitlePosition();

    const ro = new ResizeObserver(() => {
      updateTitlePosition();
    });
    if (idleBarRef.current) ro.observe(idleBarRef.current);
    if (leftClusterRef.current) ro.observe(leftClusterRef.current);
    if (rightClusterRef.current) ro.observe(rightClusterRef.current);
    window.addEventListener('resize', updateTitlePosition);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateTitlePosition);
    };
  }, [
    searchActive,
    updateTitlePosition,
    showBack,
    isMobile,
    title,
    search,
    filters,
    primaryAction,
    overflow,
    leadingAction,
  ]);

  useEffect(() => {
    if (!searchActive) return;
    const id = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [searchActive]);

  const handleBack = () => {
    if (hierarchicalBackHref) {
      navigateWithTransitionType(hierarchicalBackHref, 'nav-back', (href) =>
        router.push(href),
      );
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(homeHref);
  };

  const dismissSearch = useCallback(() => {
    filters?.onOpenChange(false);
    setSearchMode(false);
  }, [filters, setSearchMode]);

  const openSearch = useCallback(() => {
    setSearchMode(true);
  }, [setSearchMode]);

  const handleSearchChromeBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!searchMode) return;
    if (filters?.open) return;
    const next = event.relatedTarget;
    if (next instanceof Node && searchChromeRef.current?.contains(next)) {
      return;
    }
    window.setTimeout(() => {
      if (filters?.open) return;
      const active = document.activeElement;
      if (active && searchChromeRef.current?.contains(active)) return;
      dismissSearch();
    }, 0);
  };

  const overflowItems = overflow?.items ?? [];
  const hasOverflow = overflowItems.length > 0;
  /** Filters and overflow share the second slot — pages register one or the other. */
  const trailingSlot = filters ?? (hasOverflow ? 'overflow' : null);
  const showActionsGroup = Boolean(primaryAction || trailingSlot);

  const actionsGroup = showActionsGroup ? (
    <div className={TOOLBAR_GLASS_GROUP} role="group" aria-label="Acciones">
      {primaryAction ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={TOOLBAR_GLASS_GROUP_ITEM}
              aria-label={primaryAction.label}
              onClick={primaryAction.onClick}
            >
              {primaryAction.icon ?? <Plus data-icon="inline-start" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{primaryAction.label}</TooltipContent>
        </Tooltip>
      ) : null}
      {primaryAction && trailingSlot ? (
        <span className={TOOLBAR_GLASS_GROUP_DIVIDER} aria-hidden />
      ) : null}
      {filters ? (
        <ToolbarFiltersControl
          filters={filters}
          size="grouped"
          className={TOOLBAR_GLASS_GROUP_ITEM}
        />
      ) : null}
      {hasOverflow && !filters ? (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={TOOLBAR_GLASS_GROUP_ITEM}
                  aria-label="Más acciones"
                >
                  <MoreHorizontal data-icon="inline-start" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Más</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-52">
            {overflowItems.map((item) => (
              <DropdownMenuItem
                key={item.key}
                onClick={item.onClick}
                className="cursor-pointer"
                variant={item.destructive ? 'destructive' : 'default'}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  ) : null;

  const idleSearchPill = search ? (
    isMobile ? (
      <ToolbarIconButton
        label={search.placeholder ?? 'Buscar'}
        onClick={openSearch}
      >
        <Search data-icon="inline-start" />
      </ToolbarIconButton>
    ) : (
      <Button
        type="button"
        variant="ghost"
        className={cn(TOOLBAR_GLASS_SEARCH_PILL, 'justify-start font-normal')}
        aria-label={search.placeholder ?? 'Buscar'}
        onClick={openSearch}
        onFocus={openSearch}
      >
        <Search className="size-5 shrink-0" data-icon="inline-start" />
        <span className="truncate text-[15px]">
          {search.value.trim() || search.placeholder || 'Buscar'}
        </span>
      </Button>
    )
  ) : null;

  return (
    <div className="relative h-full w-full min-w-0 overflow-hidden">
      {/*
        Both panes are absolute inset-0 — use sync crossfade, not popLayout.
        popLayout briefly collapses the idle bar into a thin horizontal strip.
      */}
      <AnimatePresence initial={false}>
        {searchActive && search ? (
          <motion.div
            key="search-takeover"
            ref={searchChromeRef}
            role="search"
            className="absolute inset-0 flex items-center gap-2 px-3 sm:px-5"
            onBlur={handleSearchChromeBlur}
            initial={
              reduceMotion ? { opacity: 1 } : { opacity: 0, x: 10 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 6 }}
            transition={takeoverTransition}
          >
            <Button
              type="button"
              variant="ghost"
              className={TOOLBAR_GLASS_CANCEL}
              onClick={dismissSearch}
            >
              Cancelar
            </Button>
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-5 -translate-y-1/2 text-foreground/80"
                aria-hidden
              />
              <Input
                ref={searchInputRef}
                placeholder={search.placeholder ?? 'Buscar'}
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    dismissSearch();
                  }
                }}
                className={cn(TOOLBAR_GLASS_FIELD, 'shadow-none')}
                aria-label={search.placeholder ?? 'Buscar'}
                type="text"
                inputMode="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
            {filters ? (
              <ToolbarFiltersControl filters={filters} size="toolbar" />
            ) : null}
          </motion.div>
        ) : (
          <motion.div
            key="toolbar-idle"
            ref={idleBarRef}
            className="absolute inset-0 flex items-center gap-2 px-3 sm:px-5"
            initial={
              reduceMotion ? { opacity: 1 } : { opacity: 0, x: -8 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
            transition={takeoverTransition}
          >
            <div
              ref={leftClusterRef}
              className="z-10 flex min-w-0 shrink-0 items-center gap-0.5"
            >
              <SidebarTrigger className={TOOLBAR_GLASS_ICON} />
              {leadingAction ? (
                <>
                  <Separator
                    orientation="vertical"
                    className="mx-1.5 shrink-0 bg-border/50 data-[orientation=vertical]:h-5 dark:bg-white/15"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={TOOLBAR_GLASS_ICON}
                        asChild
                      >
                        <Link
                          href={leadingAction.href}
                          aria-label={leadingAction.label}
                        >
                          {leadingAction.icon ?? (
                            <Plus data-icon="inline-start" />
                          )}
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      {leadingAction.label}
                    </TooltipContent>
                  </Tooltip>
                </>
              ) : null}
              {!showBack ? null : (
                <>
                  <Separator
                    orientation="vertical"
                    className="mx-1.5 shrink-0 bg-border/50 data-[orientation=vertical]:h-5 dark:bg-white/15"
                  />
                  <ToolbarIconButton
                    label={
                      hierarchicalBackHref?.startsWith('/metas')
                        ? 'Volver a metas'
                        : hierarchicalBackHref?.startsWith('/wallets')
                          ? 'Volver a billeteras'
                          : 'Atrás'
                    }
                    onClick={handleBack}
                  >
                    <ChevronLeft data-icon="inline-start" />
                  </ToolbarIconButton>
                </>
              )}
            </div>

            {/* Optical center between left chrome and right actions */}
            <div
              className="pointer-events-none absolute top-1/2 z-0 -translate-x-1/2 -translate-y-1/2"
              style={titleStyle}
            >
              <div className="min-w-0 truncate text-center">
                <PageTitle />
              </div>
            </div>

            <div
              ref={rightClusterRef}
              className="z-10 ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-2"
            >
              {actionsGroup}
              {idleSearchPill}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
