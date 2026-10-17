import {
  Calendar,
  ChartLine,
  HandCoins,
  PiggyBank,
  Receipt,
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
];

export const getNavDestination = (id: NavDestinationId): NavDestination => {
  const destination = NAV_DESTINATIONS.find((item) => item.id === id);
  if (!destination) throw new Error(`Unknown nav destination: ${id}`);
  return destination;
};

/** Presupuestos lives under `/settings`; the Más sheet lists it on its own. */
export const isBudgetsPath = (pathname: string): boolean =>
  matchesSection(pathname, '/settings/budgets');

/** Mobile dock tabs, in slot order around the center + button. */
export const DOCK_DESTINATION_IDS: readonly NavDestinationId[] = [
  'panel',
  'wallets',
  'liquidity',
];

export const getDockDestinations = (): NavDestination[] =>
  DOCK_DESTINATION_IDS.map(getNavDestination);

export type OverflowNavItem = {
  id: string;
  title: string;
  getHref: () => string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

/** Pages without a top-level destination that the Más sheet still links to. */
const OVERFLOW_SHORTCUTS: readonly OverflowNavItem[] = [
  {
    id: 'budgets',
    title: 'Presupuestos',
    getHref: () => '/settings/budgets',
    icon: PiggyBank,
    isActive: isBudgetsPath,
  },
];

/** Más sheet: destinations that are not dock tabs, then the shortcuts. */
export const getOverflowDestinations = (): OverflowNavItem[] => [
  ...NAV_DESTINATIONS.filter(
    (destination) => !DOCK_DESTINATION_IDS.includes(destination.id),
  ),
  ...OVERFLOW_SHORTCUTS,
];
