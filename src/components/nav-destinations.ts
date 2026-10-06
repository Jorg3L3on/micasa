import {
  Calendar,
  ChartLine,
  CreditCard,
  HandCoins,
  PiggyBank,
  Receipt,
  Settings,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { getCurrentMonthlyPanelHref } from '@/lib/fortnight-calendar';

export type NavDestinationId =
  | 'panel'
  | 'wallets'
  | 'liquidity'
  | 'loans'
  | 'transactions'
  | 'settings';

export type NavDestination = {
  id: NavDestinationId;
  title: string;
  /** Short label for the mobile dock; falls back to `title`. */
  dockTitle?: string;
  getHref: () => string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

const matchesSection = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

/** Canonical order for the desktop rail. The mobile dock uses a subset plus shortcuts. */
export const NAV_DESTINATIONS: readonly NavDestination[] = [
  {
    id: 'panel',
    title: 'Panel financiero',
    dockTitle: 'Panel',
    getHref: getCurrentMonthlyPanelHref,
    icon: Calendar,
    isActive: (pathname) => pathname.startsWith('/monthly/'),
  },
  {
    id: 'wallets',
    title: 'Billeteras',
    getHref: () => '/wallets',
    icon: Wallet,
    isActive: (pathname) =>
      (matchesSection(pathname, '/wallets') &&
        !matchesSection(pathname, '/wallets/liquidity')) ||
      matchesSection(pathname, '/credit-cards'),
  },
  {
    id: 'loans',
    title: 'Préstamos',
    getHref: () => '/loans',
    icon: HandCoins,
    isActive: (pathname) => matchesSection(pathname, '/loans'),
  },
  {
    id: 'liquidity',
    title: 'Análisis',
    getHref: () => '/wallets/liquidity',
    icon: ChartLine,
    isActive: (pathname) => matchesSection(pathname, '/wallets/liquidity'),
  },
  {
    id: 'transactions',
    title: 'Operaciones',
    getHref: () => '/transactions',
    icon: Receipt,
    isActive: (pathname) => matchesSection(pathname, '/transactions'),
  },
  {
    id: 'settings',
    title: 'Configuración',
    getHref: () => '/settings',
    icon: Settings,
    isActive: (pathname) => matchesSection(pathname, '/settings'),
  },
];

export const getNavDestination = (id: NavDestinationId): NavDestination => {
  const destination = NAV_DESTINATIONS.find((item) => item.id === id);
  if (!destination) throw new Error(`Unknown nav destination: ${id}`);
  return destination;
};

/** Credit-card detail lives under `/credit-cards`; the index redirects to Billeteras. */
export const isCreditCardPath = (pathname: string): boolean =>
  pathname === '/credit-cards' || pathname.startsWith('/credit-cards/');

/** Presupuestos stays under Configuración; the dock can highlight it on its own. */
export const isBudgetsPath = (pathname: string): boolean =>
  matchesSection(pathname, '/settings/budgets');

export type MobileDockItem = {
  id: string;
  title: string;
  getHref: () => string;
  icon: LucideIcon;
  /** Dock highlight. May be narrower than the desktop destination's `isActive`. */
  isActive: (pathname: string) => boolean;
};

const destinationDockItem = (
  id: NavDestinationId,
  isActive?: (pathname: string) => boolean,
): MobileDockItem => {
  const destination = getNavDestination(id);
  return {
    id: destination.id,
    title: destination.title,
    getHref: destination.getHref,
    icon: destination.icon,
    isActive: isActive ?? destination.isActive,
  };
};

/**
 * Mobile pill primaries, in slot order. Shortcuts reuse existing pages:
 * Tarjetas → Billeteras (cards have no separate list), Presupuestos → `/settings/budgets`.
 * Análisis and Operaciones stay in the overflow sheet.
 */
export const MOBILE_DOCK_ITEMS: readonly MobileDockItem[] = [
  destinationDockItem('panel'),
  destinationDockItem(
    'wallets',
    (pathname) =>
      getNavDestination('wallets').isActive(pathname) &&
      !isCreditCardPath(pathname),
  ),
  {
    id: 'credit-cards',
    title: 'Tarjetas',
    getHref: () => '/wallets',
    icon: CreditCard,
    isActive: isCreditCardPath,
  },
  destinationDockItem('loans'),
  {
    id: 'budgets',
    title: 'Presupuestos',
    getHref: () => '/settings/budgets',
    icon: PiggyBank,
    isActive: isBudgetsPath,
  },
  destinationDockItem(
    'settings',
    (pathname) =>
      getNavDestination('settings').isActive(pathname) &&
      !isBudgetsPath(pathname),
  ),
];

const MOBILE_DOCK_DESTINATION_IDS = new Set<string>(
  MOBILE_DOCK_ITEMS.map((item) => item.id),
);

export const getMobileDockItems = (): readonly MobileDockItem[] =>
  MOBILE_DOCK_ITEMS;

/** Destinations that are not one of the six mobile primaries. */
export const getOverflowDestinations = (): NavDestination[] =>
  NAV_DESTINATIONS.filter(
    (destination) => !MOBILE_DOCK_DESTINATION_IDS.has(destination.id),
  );
