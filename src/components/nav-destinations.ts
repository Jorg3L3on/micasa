import {
  Calendar,
  ChartLine,
  Goal,
  HandCoins,
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
  | 'goals'
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

/** Canonical order shared by the sidebar (desktop + Más sheet) and the mobile dock. */
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
    id: 'goals',
    title: 'Metas',
    getHref: () => '/metas',
    icon: Goal,
    isActive: (pathname) => matchesSection(pathname, '/metas'),
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

/** Link tabs in the mobile dock, in slot order. Más follows them; the create "+" is the header icon. */
export const DOCK_DESTINATION_IDS: readonly NavDestinationId[] = [
  'panel',
  'wallets',
  'liquidity',
];

export const getNavDestination = (id: NavDestinationId): NavDestination => {
  const destination = NAV_DESTINATIONS.find((item) => item.id === id);
  if (!destination) throw new Error(`Unknown nav destination: ${id}`);
  return destination;
};

export const getDockDestinations = (): NavDestination[] =>
  DOCK_DESTINATION_IDS.map(getNavDestination);
