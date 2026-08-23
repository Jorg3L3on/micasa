import {
  BadgeCheck,
  Bell,
  ClipboardList,
  FolderTree,
  Plug,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type SettingsNavSection = 'cuenta' | 'catalogos' | 'automatizaciones';

export type SettingsNavItem = {
  href: string | null;
  label: string;
  icon: LucideIcon;
  section: SettingsNavSection;
  /** Match path prefix for active state (defaults to href). */
  matchPrefix?: string;
  houseOnly?: boolean;
  disabled?: boolean;
};

export const SETTINGS_NAV_SECTIONS: {
  id: SettingsNavSection;
  label: string;
}[] = [
  { id: 'cuenta', label: 'Cuenta' },
  { id: 'automatizaciones', label: 'Automatizaciones' },
  { id: 'catalogos', label: 'Catálogos' },
];

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  {
    href: '/settings/account',
    label: 'Cuenta',
    icon: BadgeCheck,
    section: 'cuenta',
  },
  {
    href: '/settings/connections',
    label: 'Conexiones',
    icon: Plug,
    section: 'cuenta',
  },
  {
    href: null,
    label: 'Notificaciones',
    icon: Bell,
    section: 'cuenta',
    disabled: true,
  },
  {
    href: '/settings/expense-templates',
    label: 'Gastos programados',
    icon: ClipboardList,
    section: 'automatizaciones',
    matchPrefix: '/settings/expense-templates',
  },
  {
    href: '/settings/income-templates',
    label: 'Ingresos programados',
    icon: TrendingUp,
    section: 'automatizaciones',
    matchPrefix: '/settings/income-templates',
  },
  {
    href: '/settings/categories',
    label: 'Categorías',
    icon: FolderTree,
    section: 'catalogos',
  },
  {
    href: '/settings/house-users',
    label: 'Usuarios de la casa',
    icon: Users,
    section: 'catalogos',
    houseOnly: true,
  },
];

export function filterSettingsNavItems(
  items: SettingsNavItem[],
  isHouseContext: boolean,
): SettingsNavItem[] {
  return items.filter((item) => !item.houseOnly || isHouseContext);
}

export function isSettingsNavItemActive(
  pathname: string,
  item: SettingsNavItem,
): boolean {
  if (!item.href) return false;
  const prefix = item.matchPrefix ?? item.href;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}
