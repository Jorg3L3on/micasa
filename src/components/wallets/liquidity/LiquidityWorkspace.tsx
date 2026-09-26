'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/motion/tabs';
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
    <Tabs
      defaultValue="liquidez"
      variant="underline"
      className="flex flex-col gap-6"
    >
      <TabsList
        aria-label={PLAN_COPY.tabListLabel}
        wrapperClassName="sticky top-16 z-30 w-full bg-transparent group-has-data-[collapsible=icon]/sidebar-wrapper:top-12"
        className="w-full gap-0 border-b border-border/60 bg-transparent p-0"
      >
        <TabsTrigger
          value="liquidez"
          className="min-h-11 flex-1 justify-center px-4 text-sm"
        >
          {PLAN_COPY.tabLiquidity}
        </TabsTrigger>
        <TabsTrigger
          value="plan"
          className="min-h-11 flex-1 justify-center px-4 text-sm"
        >
          {PLAN_COPY.tabPlan}
        </TabsTrigger>
      </TabsList>
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
      <TabsContent value="plan" className="mt-0 outline-none">
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
