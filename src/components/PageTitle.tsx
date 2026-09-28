'use client';

import { usePathname } from 'next/navigation';
import { useFinanceContext } from '@/context/finance-context';
import { formatMonthHeading } from '@/lib/calendar-dates';
import { getAppHomeHref, formatFortnightDateRangeLabel } from '@/lib/fortnight-calendar';
import type { FinanceContextType } from '@/types/finance-context';
import {
  monthlyHeaderPeriodLabel,
  monthlyHeaderPeriodShortLabel,
  useMonthlyHeaderPeriod,
} from '@/components/monthly/monthly-header-period';

const buildOwnerSuffix = (context: FinanceContextType): string => {
  if (context.type === 'user' && context.id === 0) return '';
  return `ownerType=${context.type}&ownerId=${context.id}`;
};

/** Top-level module indexes — no toolbar back (avoids history confusion). */
const MODULE_ROOT_SEGMENTS = new Set([
  'wallets',
  'metas',
  'loans',
  'transactions',
  'categories',
  'account',
  'house-users',
]);

/**
 * Whether the toolbar should show Back.
 * Hidden on Panel financiero and on each module’s main list / hub page.
 */
export function shouldShowToolbarBack(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return false;
  if (segments[0] === 'dashboard') return false;
  if (segments[0] === 'monthly') return false;

  // Single-segment hubs: /wallets, /metas, /budgets, …
  if (segments.length === 1 && MODULE_ROOT_SEGMENTS.has(segments[0])) {
    return false;
  }

  // Sidebar hub: Análisis
  if (
    segments[0] === 'wallets' &&
    segments[1] === 'liquidity' &&
    segments.length === 2
  ) {
    return false;
  }

  // Settings section hubs: /settings/account, lists (not new/edit)
  if (segments[0] === 'settings' && segments.length <= 2) {
    return false;
  }

  // Legacy template list roots
  if (
    (segments[0] === 'expense-templates' ||
      segments[0] === 'income-templates') &&
    segments.length === 1
  ) {
    return false;
  }

  return true;
}

export function getPageTitle(pathname: string): {
  title: string;
  /** True when this route is the product home (Panel financiero / monthly). */
  isHome: boolean;
  /** Toolbar Back — false on home and module index hubs. */
  showBack: boolean;
} {
  const segments = pathname.split('/').filter(Boolean);
  const showBack = shouldShowToolbarBack(pathname);

  if (segments[0] === 'monthly' && segments[1] && segments[2]) {
    const year = parseInt(segments[1], 10);
    const month = parseInt(segments[2], 10);
    return {
      title: formatMonthHeading(month, year),
      isHome: true,
      showBack: false,
    };
  }

  if (segments.length === 0 || segments[0] === 'dashboard') {
    return { title: 'Panel financiero', isHome: true, showBack: false };
  }

  if (segments[0] === 'settings') {
    if (segments[1] === 'expense-templates') {
      if (segments[2] === 'new')
        return { title: 'Agregar plantilla de gastos', isHome: false, showBack };
      if (segments[3] === 'edit')
        return { title: 'Editar plantilla', isHome: false, showBack };
      return { title: 'Gastos programados', isHome: false, showBack };
    }
    if (segments[1] === 'income-templates') {
      if (segments[2] === 'new')
        return { title: 'Agregar plantilla de ingresos', isHome: false, showBack };
      if (segments[3] === 'edit')
        return { title: 'Editar plantilla', isHome: false, showBack };
      return { title: 'Ingresos programados', isHome: false, showBack };
    }
    if (segments[1] === 'house-users') {
      return { title: 'Usuarios de la casa', isHome: false, showBack };
    }
    if (segments[1] === 'categories') {
      return { title: 'Categorías', isHome: false, showBack };
    }
    if (segments[1] === 'budgets') {
      return { title: 'Presupuestos', isHome: false, showBack };
    }
    if (segments[1] === 'account') {
      return { title: 'Cuenta', isHome: false, showBack };
    }
    if (segments[1] === 'connections') {
      return { title: 'Conexiones', isHome: false, showBack };
    }
    return { title: 'Configuración', isHome: false, showBack };
  }

  if (segments[0] === 'expense-templates') {
    if (segments[1] === 'new')
      return { title: 'Agregar plantilla de gastos', isHome: false, showBack };
    if (segments[2] === 'edit')
      return { title: 'Editar plantilla', isHome: false, showBack };
    return { title: 'Plantillas de gastos', isHome: false, showBack };
  }

  if (segments[0] === 'income-templates') {
    if (segments[1] === 'new')
      return { title: 'Agregar plantilla de ingresos', isHome: false, showBack };
    if (segments[2] === 'edit')
      return { title: 'Editar plantilla', isHome: false, showBack };
    return { title: 'Plantillas de ingresos', isHome: false, showBack };
  }

  if (
    segments[0] === 'fortnight' &&
    segments[1] &&
    segments[2] &&
    segments[3]
  ) {
    const year = parseInt(segments[1], 10);
    const month = parseInt(segments[2], 10);
    const period = segments[3].toUpperCase() as 'FIRST' | 'SECOND';
    const periodLabel = formatFortnightDateRangeLabel(year, month, period);
    return {
      title: `${periodLabel} · ${year}`,
      isHome: false,
      showBack,
    };
  }

  if (segments[0] === 'wallets') {
    if (segments[1] === 'liquidity') {
      return { title: 'Análisis', isHome: false, showBack };
    }
    if (segments[1]) {
      return { title: 'Billetera', isHome: false, showBack };
    }
    return { title: 'Billeteras', isHome: false, showBack };
  }

  if (segments[0] === 'metas') {
    if (segments[1]) return { title: 'Meta', isHome: false, showBack };
    return { title: 'Metas', isHome: false, showBack };
  }

  if (segments[0] === 'credit-cards') {
    return { title: 'Estado de cuenta', isHome: false, showBack };
  }

  if (segments[0] === 'loans') {
    return { title: 'Préstamos', isHome: false, showBack };
  }

  if (segments[0] === 'transactions') {
    return { title: 'Operaciones', isHome: false, showBack };
  }

  if (segments[0] === 'house-users') {
    return { title: 'Usuarios de la casa', isHome: false, showBack };
  }

  const pageTitles: Record<string, string> = {
    account: 'Cuenta',
    categories: 'Categorías',
  };

  const pageTitle = pageTitles[segments[0]] || segments[0];
  return { title: pageTitle, isHome: false, showBack };
}

export function useAppPageTitle() {
  const pathname = usePathname();
  const headerPeriod = useMonthlyHeaderPeriod();
  const pageTitle = getPageTitle(pathname);
  if (!headerPeriod || !pathname.startsWith('/monthly/')) {
    return { ...pageTitle, periodPrefix: null };
  }
  const periodPrefix = {
    full: monthlyHeaderPeriodLabel(headerPeriod),
    short: monthlyHeaderPeriodShortLabel(headerPeriod),
  };
  return {
    ...pageTitle,
    title: `${periodPrefix.full} · ${pageTitle.title}`,
    baseTitle: pageTitle.title,
    periodPrefix,
  };
}

export function useAppHomeHref() {
  const { context } = useFinanceContext();
  const ownerQs = buildOwnerSuffix(context);
  return getAppHomeHref(ownerQs);
}

/** Centered toolbar title (Apple-style principal). */
export default function PageTitle() {
  const pageTitle = useAppPageTitle();
  if (!pageTitle.periodPrefix) {
    return (
      <h1 className="truncate text-title">
        {pageTitle.title}
      </h1>
    );
  }
  return (
    <h1
      className="truncate text-title"
      aria-label={pageTitle.title}
    >
      <span className="sm:hidden">{pageTitle.periodPrefix.short}</span>
      <span className="hidden sm:inline">{pageTitle.periodPrefix.full}</span>
      {` · ${pageTitle.baseTitle}`}
    </h1>
  );
}
