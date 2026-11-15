'use client';

import { useCallback, useState } from 'react';
import { Landmark, LineChart, ShoppingBag } from 'lucide-react';
import { MobilePullToRefresh } from '@/components/motion/mobile-pull-to-refresh';
import { TabsContent } from '@/components/motion/tabs';
import { SegmentedControl } from '@/components/segmented-control';
import {
  AURA_TAB_INDICATOR_CLASS,
  GLASS_TAB_ACTIVE_LABEL_CLASS,
  MONTHLY_LIQUID_PANEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { LiquidityProjectionTab } from '@/components/wallets/liquidity/LiquidityProjectionTab';
import { LiquidityDebtsTab } from '@/components/wallets/liquidity/LiquidityDebtsTab';
import { PurchaseSimulatorTab } from '@/components/wallets/liquidity/purchase/PurchaseSimulatorTab';
import { PURCHASE_COPY } from '@/components/wallets/liquidity/purchase/copy';
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

  const [tab, setTab] = useState('liquidez');
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
        value={tab}
        onValueChange={setTab}
        ariaLabel="Análisis"
        className="flex flex-col gap-4 sm:gap-5"
        stretch
        frameClassName={cn(
          MONTHLY_LIQUID_PANEL_CLASS,
          'flex w-full min-w-0 items-center p-1 sm:p-1.5',
        )}
        wrapperClassName="min-w-0 flex-1"
        listClassName="w-full"
        indicatorClassName={AURA_TAB_INDICATOR_CLASS}
        activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
        options={[
          {
            value: 'liquidez',
            label: (
              <span className={WORKSPACE_TAB_LABEL_CLASS}>
                <LineChart className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Proyección
              </span>
            ),
          },
          {
            value: 'deudas',
            label: (
              <span className={WORKSPACE_TAB_LABEL_CLASS}>
                <Landmark className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Deudas
              </span>
            ),
          },
          {
            value: 'simular',
            label: (
              <span className={WORKSPACE_TAB_LABEL_CLASS}>
                <ShoppingBag className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="sm:hidden">{PURCHASE_COPY.tabShort}</span>
                <span className="hidden sm:inline">{PURCHASE_COPY.tab}</span>
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
          />
        </TabsContent>
        <TabsContent value="deudas" className="mt-0 outline-none">
          <LiquidityDebtsTab
            data={data}
            loading={loading}
            error={error}
            onReload={() => void reload()}
            refreshToken={refreshToken}
          />
        </TabsContent>
        <TabsContent value="simular" className="mt-0 outline-none">
          <PurchaseSimulatorTab />
        </TabsContent>
      </SegmentedControl>
    </MobilePullToRefresh>
  );
};
