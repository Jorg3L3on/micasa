'use client';

import { useCallback, useState } from 'react';
import { LineChart, Route } from 'lucide-react';
import { MobilePullToRefresh } from '@/components/motion/mobile-pull-to-refresh';
import { TabsContent } from '@/components/motion/tabs';
import { SegmentedControl } from '@/components/segmented-control';
import {
  AURA_TAB_INDICATOR_CLASS,
  GLASS_TAB_ACTIVE_LABEL_CLASS,
  MONTHLY_LIQUID_PANEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { LiquidityProjectionTab } from '@/components/wallets/liquidity/LiquidityProjectionTab';
import { CashPlanTab } from '@/components/wallets/liquidity/plan/CashPlanTab';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import { useLiquidityProjection } from '@/components/wallets/liquidity/use-liquidity-projection';
import { cn } from '@/lib/utils';

const WORKSPACE_TAB_LABEL_CLASS = 'inline-flex items-center justify-center gap-1.5';

export const LiquidityWorkspace = () => {
  const {
    data,
    loading,
    error,
    reload,
    selectedMonthKey,
    setSelectedMonthKey,
  } = useLiquidityProjection();

  const [refreshToken, setRefreshToken] = useState(0);

  const handlePullRefresh = useCallback(async () => {
    await reload({ silent: true });
    setRefreshToken((token) => token + 1);
  }, [reload]);

  return (
    <MobilePullToRefresh
      onRefresh={handlePullRefresh}
      ariaLabel="Análisis"
      errorMessage="No se pudo actualizar tu panorama. Intenta de nuevo."
    >
      <SegmentedControl
        defaultValue="liquidez"
        ariaLabel={PLAN_COPY.tabListLabel}
        className="flex flex-col gap-4 sm:gap-5"
        stretch
        frameClassName={cn(
          MONTHLY_LIQUID_PANEL_CLASS,
          'flex w-full min-w-0 items-center p-1 sm:max-w-sm sm:p-1.5',
        )}
        wrapperClassName="min-w-0 flex-1"
        indicatorClassName={AURA_TAB_INDICATOR_CLASS}
        activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
        options={[
          {
            value: 'liquidez',
            label: (
              <span className={WORKSPACE_TAB_LABEL_CLASS}>
                <LineChart className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {PLAN_COPY.tabLiquidity}
              </span>
            ),
          },
          {
            value: 'plan',
            label: (
              <span className={WORKSPACE_TAB_LABEL_CLASS}>
                <Route className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {PLAN_COPY.tabPlan}
              </span>
            ),
          },
        ]}
      >
        <TabsContent value="liquidez" className="mt-0 outline-none">
          <LiquidityProjectionTab
            data={data}
            loading={loading}
            error={error}
            onReload={() => void reload()}
            selectedMonthKey={selectedMonthKey}
            onSelectedMonthKeyChange={setSelectedMonthKey}
            refreshToken={refreshToken}
          />
        </TabsContent>
        <TabsContent value="plan" className="mt-0 outline-none">
          <CashPlanTab
            data={data}
            loading={loading}
            error={error}
            onReload={() => void reload()}
            selectedMonthKey={selectedMonthKey}
          />
        </TabsContent>
      </SegmentedControl>
    </MobilePullToRefresh>
  );
};
