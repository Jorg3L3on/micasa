'use client';

import type { LiquidityProjectionResponse } from '@/types/catalog';
import { LiquidityAccountsToday } from '@/components/wallets/liquidity/LiquidityAccountsToday';
import { LiquidityFundingWalletsMenu } from '@/components/wallets/liquidity/LiquidityFundingWalletsMenu';
import { MONTHLY_PANEL_MAIN_COLUMN_CLASS } from '@/components/monthly/MonthlyPanelLayout';
import { ErrorBanner } from '@/components/error-banner';
import { PlannerPageSkeleton } from '@/components/loading/page-skeletons';
import { Button } from '@/components/ui/button';

type LiquidityDebtsTabProps = {
  data: LiquidityProjectionResponse | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
  /** Bumped after a pull-to-refresh so the accounts card reloads too. */
  refreshToken?: number;
};

/** Análisis → Deudas: every card and loan as of today, with what is owed and what is free. */
export const LiquidityDebtsTab = ({
  data,
  loading,
  error,
  onReload,
  refreshToken = 0,
}: LiquidityDebtsTabProps) => (
  <div className={MONTHLY_PANEL_MAIN_COLUMN_CLASS}>
    {error ? (
      <div className="mb-5 space-y-3">
        <ErrorBanner>{error}</ErrorBanner>
        <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={onReload}>
          Reintentar
        </Button>
      </div>
    ) : null}

    {loading && !data ? <PlannerPageSkeleton /> : null}

    {data ? (
      <LiquidityAccountsToday
        fundingTotal={data.summary.funding_total ?? 0}
        onChanged={onReload}
        actions={<LiquidityFundingWalletsMenu onChanged={onReload} />}
        refreshToken={refreshToken}
      />
    ) : null}
  </div>
);
