'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PullToRefresh } from '@/components/motion/pull-to-refresh';
import { useMonthlyPanelRefresh } from '@/components/monthly/monthly-panel-refresh';
import { MonthlyPanelPreferencesProvider } from '@/components/monthly/MonthlyPanelPreferences';
import { MonthlyChromeHeader } from '@/components/monthly/MonthlyChromeHeader';
import {
  MONTHLY_CHROME_PADDING_CLASS,
  MONTHLY_LIQUID_PANEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { PanelCardSkeleton } from '@/components/loading/page-skeletons';
import { useOptionalQuickCapture } from '@/components/quick-capture/QuickCaptureHost';
import { PAGE_CREATE_ACTION } from '@/lib/ui/page-create-action';
import { useFinanceContext } from '@/context/finance-context';
import { useRegisterToolbarActions } from '@/context/toolbar-actions-context';
import { isPanelOwnerPending } from '@/lib/api/client-fetch';
import { cn } from '@/lib/utils';

type FortnightPeriod = 'FIRST' | 'SECOND';

type MonthlyPanelLayoutProps = {
  ownerKey: string;
  /** True when the request URL named the owner (`?ownerType=&ownerId=`). */
  ownerInUrl: boolean;
  year: number;
  month: number;
  monthName: string;
  isCurrentMonth: boolean;
  currentMonthHref: string;
  todayYmd: string;
  suggestedPeriod: FortnightPeriod;
  ownerQuery: string;
  firstLabel: string;
  secondLabel: string;
  prevControl: ReactNode;
  nextNavControl?: ReactNode;
  createNextControl?: ReactNode;
  children: ReactNode;
};

export const MonthlyPanelLayout = ({
  ownerKey,
  ownerInUrl,
  year,
  month,
  monthName,
  isCurrentMonth,
  currentMonthHref,
  todayYmd,
  suggestedPeriod,
  ownerQuery,
  firstLabel,
  secondLabel,
  prevControl,
  nextNavControl = null,
  createNextControl = null,
  children,
}: MonthlyPanelLayoutProps) => {
  const ownerPending = useMonthlyOwnerPending(ownerKey, ownerInUrl);
  const refreshPanel = useMonthlyPanelRefresh();
  const handlePullRefresh = useCallback(async () => {
    try {
      await refreshPanel();
    } catch (error) {
      console.error('Error refreshing panel data:', error);
      toast.error(
        'No se pudo refrescar el panel. Recarga si los montos no cambiaron.',
      );
    }
  }, [refreshPanel]);
  const quickCapture = useOptionalQuickCapture();
  const primaryActionIcon = useMemo(
    () => <Plus data-icon="inline-start" />,
    [],
  );

  useRegisterToolbarActions({
    primaryAction: quickCapture
      ? {
          label: PAGE_CREATE_ACTION.expenseOrIncome.label,
          onClick: quickCapture.open,
          icon: primaryActionIcon,
        }
      : null,
  });

  return (
    <MonthlyPanelPreferencesProvider
      ownerKey={ownerKey}
      year={year}
      month={month}
      suggestedPeriod={suggestedPeriod}
    >
      <PullToRefresh
        onRefresh={handlePullRefresh}
        ariaLabel="Panel financiero"
        pullingLabel="Desliza para actualizar"
        releaseLabel="Suelta para actualizar"
        refreshingLabel="Actualizando"
        className="bg-transparent"
        contentClassName="bg-transparent"
      >
      <div
        className={cn(
          '@container',
          MONTHLY_LIQUID_PANEL_CLASS,
          MONTHLY_CHROME_PADDING_CLASS,
          'mb-5',
        )}
      >
        <MonthlyChromeHeader
          year={year}
          month={month}
          monthName={monthName}
          isCurrentMonth={isCurrentMonth}
          currentMonthHref={currentMonthHref}
          todayYmd={todayYmd}
          ownerQuery={ownerQuery}
          firstLabel={firstLabel}
          secondLabel={secondLabel}
          prevControl={prevControl}
          nextNavControl={nextNavControl}
          createNextControl={ownerPending ? null : createNextControl}
        />
      </div>

      {ownerPending ? <MonthlyOwnerSwitchFallback /> : children}
      </PullToRefresh>
    </MonthlyPanelPreferencesProvider>
  );
};

/**
 * True while the server page may belong to another owner (see
 * `isPanelOwnerPending`). Nothing owner-specific (empty month, Crear mes) may
 * render or fetch in that window.
 */
export const useMonthlyOwnerPending = (
  ownerKey: string,
  ownerInUrl: boolean,
): boolean => {
  const { context } = useFinanceContext();
  return isPanelOwnerPending(context, ownerKey, ownerInUrl);
};

type MonthlyOwnerGateProps = {
  ownerKey: string;
  ownerInUrl: boolean;
  fallback: ReactNode;
  children: ReactNode;
};

/** Renders `fallback` instead of `children` while the owner is pending. */
export const MonthlyOwnerGate = ({
  ownerKey,
  ownerInUrl,
  fallback,
  children,
}: MonthlyOwnerGateProps) =>
  useMonthlyOwnerPending(ownerKey, ownerInUrl) ? fallback : children;

export const MonthlyOwnerSwitchFallback = () => (
  <div
    className={MONTHLY_PANEL_CONTENT_GRID_CLASS}
    role="status"
    aria-busy="true"
    aria-label="Cargando casa"
  >
    <div className={MONTHLY_PANEL_MAIN_COLUMN_CLASS}>
      <div className="space-y-4">
        {/* Heights match the real Balance/Liquidez tiles, Compromiso and
            Gastos cards at 375px so nothing jumps when the owner resolves. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <PanelCardSkeleton bodyClassName="h-11" className="overflow-hidden" />
          <PanelCardSkeleton bodyClassName="h-11" className="overflow-hidden" />
        </div>
        <PanelCardSkeleton bodyClassName="h-16" />
        <PanelCardSkeleton bodyClassName="h-72" />
      </div>
    </div>
    <div className={MONTHLY_PANEL_SIDEBAR_COLUMN_CLASS}>
      <PanelCardSkeleton bodyClassName="h-56" />
      <PanelCardSkeleton bodyClassName="h-40" />
      <PanelCardSkeleton bodyClassName="h-36" />
    </div>
  </div>
);

export const MONTHLY_PANEL_CONTENT_GRID_CLASS =
  'grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] xl:items-start';

export const MONTHLY_PANEL_MAIN_COLUMN_CLASS =
  'mx-auto min-w-0 w-full max-w-4xl xl:max-w-none';

export const MONTHLY_PANEL_SIDEBAR_COLUMN_CLASS =
  'flex min-w-0 flex-col gap-5';

/**
 * Hides main-column content that the sidebar repeats (e.g. the wallet strip vs
 * the Billeteras card). Same breakpoint as MONTHLY_PANEL_SIDEBAR_COLUMN_CLASS:
 * change both together.
 */
export const MONTHLY_PANEL_SIDEBAR_DUPLICATE_CLASS = 'xl:hidden';
