'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LiquidityProjectionTab } from '@/components/wallets/liquidity/LiquidityProjectionTab';
import { CashPlanTab } from '@/components/wallets/liquidity/plan/CashPlanTab';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import { useLiquidityProjection } from '@/components/wallets/liquidity/use-liquidity-projection';

export const LiquidityWorkspace = () => {
  const {
    data,
    loading,
    error,
    reload,
    selectedMonthKey,
    setSelectedMonthKey,
  } = useLiquidityProjection();

  return (
    <Tabs defaultValue="liquidez" className="gap-6">
      <TabsList
        variant="line"
        aria-label={PLAN_COPY.tabListLabel}
        className="sticky top-16 z-30 h-auto w-full justify-start rounded-none border-b border-border/60 bg-background/85 px-0 backdrop-blur-xl group-has-data-[collapsible=icon]/sidebar-wrapper:top-12 dark:bg-[#060914]/70"
      >
        <TabsTrigger value="liquidez" className="min-h-11 px-4 text-sm">
          {PLAN_COPY.tabLiquidity}
        </TabsTrigger>
        <TabsTrigger value="plan" className="min-h-11 px-4 text-sm">
          {PLAN_COPY.tabPlan}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="liquidez" forceMount className="data-[state=inactive]:hidden">
        <LiquidityProjectionTab
          data={data}
          loading={loading}
          error={error}
          onReload={() => void reload()}
          selectedMonthKey={selectedMonthKey}
          onSelectedMonthKeyChange={setSelectedMonthKey}
        />
      </TabsContent>
      <TabsContent value="plan" forceMount className="data-[state=inactive]:hidden">
        <CashPlanTab
          data={data}
          loading={loading}
          error={error}
          onReload={() => void reload()}
          selectedMonthKey={selectedMonthKey}
        />
      </TabsContent>
    </Tabs>
  );
};
