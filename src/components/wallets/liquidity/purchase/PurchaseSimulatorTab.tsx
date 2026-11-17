'use client';

import { useState } from 'react';
import { ShoppingBag, Wallet } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { ErrorBanner } from '@/components/error-banner';
import {
  MONTHLY_PANEL_CONTENT_GRID_CLASS,
  MONTHLY_PANEL_MAIN_COLUMN_CLASS,
  MONTHLY_PANEL_SIDEBAR_COLUMN_CLASS,
} from '@/components/monthly/MonthlyPanelLayout';
import { MONTHLY_LIQUID_PANEL_CLASS, PANEL_INSET_CLASS } from '@/components/monthly/monthly-panel-shell';
import { SectionHeader } from '@/components/section-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { PURCHASE_COPY as C } from '@/components/wallets/liquidity/purchase/copy';
import { PurchaseForm } from '@/components/wallets/liquidity/purchase/PurchaseForm';
import { KpiTiles, VerdictPanel } from '@/components/wallets/liquidity/purchase/VerdictPanel';
import { QuincenaPanel, QuincenaTable } from '@/components/wallets/liquidity/purchase/QuincenaPanel';
import { AssumptionsPanel, PaymentCalendar } from '@/components/wallets/liquidity/purchase/PlanPanels';
import {
  usePurchaseSimulation,
  type PurchaseSimulationController,
} from '@/components/wallets/liquidity/purchase/use-purchase-simulation';

const ResultSkeleton = () => (
  <div className="flex flex-col gap-5" aria-busy="true" aria-label={C.calculating}>
    <div className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'space-y-3 p-4')}>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
    </div>
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
    </div>
    <div className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'flex h-60 items-end gap-1 p-4')}>
      {[40, 62, 30, 55, 20, 70, 48, 60, 35, 66, 44, 58].map((h, i) => <Skeleton key={i} className="flex-1 rounded-sm" style={{ height: `${h}%` }} />)}
    </div>
  </div>
);

export const PurchaseResults = ({ sim }: { sim: PurchaseSimulationController }) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const { result, loading, error } = sim;

  if (!sim.hasBody && !result) {
    return (
      <section className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'p-4 sm:p-6')}>
        <EmptyState icon={ShoppingBag} message={C.emptyTitle} description={C.emptyBody} />
      </section>
    );
  }
  if (!result) {
    return (
      <div className="flex flex-col gap-4">
        {error ? (
          <ErrorBanner>
            <p className="font-medium">{C.errorTitle}</p>
            <p className="mt-0.5">{error}</p>
            <Button type="button" variant="outline" className="mt-2 h-9 rounded-xl" onClick={sim.retry}>{C.retry}</Button>
          </ErrorBanner>
        ) : (
          <ResultSkeleton />
        )}
      </div>
    );
  }

  const dimmed = loading || error != null;
  return (
    <div className="flex flex-col gap-5">
      {loading ? (
        <p role="status" className="self-end rounded-full bg-primary/20 px-3 py-0.5 text-caption font-semibold">{C.calculating}</p>
      ) : null}
      {error ? (
        <ErrorBanner>
          <p className="font-medium">{C.errorTitle}</p>
          <p className="mt-0.5">{error} {C.previousResult} abajo.</p>
          <Button type="button" variant="outline" className="mt-2 h-9 rounded-xl" onClick={sim.retry}>{C.retry}</Button>
        </ErrorBanner>
      ) : null}
      <VerdictPanel result={result} dimmed={dimmed} />
      <KpiTiles result={result} dimmed={dimmed} />
      <QuincenaPanel
        result={result}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        dimmed={dimmed}
      />
      <QuincenaTable result={result} selectedKey={selectedKey} onSelect={setSelectedKey} dimmed={dimmed} />
      <PaymentCalendar result={result} dimmed={dimmed} />
      <AssumptionsPanel result={result} />
    </div>
  );
};

/** Análisis › Simular compra (MIC-I17). Replaces the Plan tab. */
export const PurchaseSimulatorTab = () => {
  const sim = usePurchaseSimulation();
  const isMobile = useIsMobile();
  const [formOpen, setFormOpen] = useState(true);

  if (sim.walletsError && !sim.wallets) {
    return (
      <ErrorBanner>
        <p className="font-medium">{C.errorTitle}</p>
        <p className="mt-0.5">{sim.walletsError}</p>
      </ErrorBanner>
    );
  }
  if (!sim.wallets) return <ResultSkeleton />;
  if (sim.wallets.length === 0) {
    return (
      <section className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'p-4 sm:p-6')}>
        <EmptyState icon={Wallet} message={C.noWalletsTitle} description={C.noWalletsBody} action={{ label: C.addWallet, href: '/wallets' }} />
      </section>
    );
  }

  const folded = isMobile && !formOpen && sim.draft.total > 0;
  const wallet = sim.wallets.find((w) => w.id === sim.draft.walletId);
  const how =
    sim.draft.mode === 'contado'
      ? `De contado${wallet ? ` con ${wallet.name}` : ''}`
      : sim.draft.mode === 'msi'
        ? `${sim.draft.months} meses sin intereses${wallet ? ` con ${wallet.name}` : ''}`
        : `${typeof sim.draft.lender === 'number' ? 'Con intereses en tu tarjeta' : 'Crédito nuevo'} a ${sim.draft.creditMonths} meses`;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {sim.notice ? (
        <div role="status" className={cn(PANEL_INSET_CLASS, 'flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm')}>
          <span>{sim.notice}</span>
          <button type="button" onClick={sim.dismissNotice} className="text-xs font-semibold text-primary-text underline underline-offset-4">{C.understood}</button>
        </div>
      ) : null}
      <div className={MONTHLY_PANEL_CONTENT_GRID_CLASS}>
        <aside aria-label={C.formTitle} className={cn(MONTHLY_PANEL_SIDEBAR_COLUMN_CLASS, 'xl:order-2 xl:sticky xl:top-24')}>
          {folded ? (
            <section className={cn(MONTHLY_LIQUID_PANEL_CLASS, 'p-3')}>
              <SectionHeader
                icon={ShoppingBag}
                title={C.formTitle}
                subtitle={C.formSubtitle}
                actions={<Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => setFormOpen(true)}>{C.edit}</Button>}
              />
              <div className={cn(PANEL_INSET_CLASS, 'mt-3 px-3 py-2.5')}>
                <p className="flex justify-between gap-3 text-sm font-semibold">
                  <span className="truncate" title={sim.draft.name || 'Tu compra'}>{sim.draft.name || 'Tu compra'}</span>
                  <span className="tabular-nums">{formatMoney(sim.draft.total)}</span>
                </p>
                <p className="text-caption text-muted-foreground">{how}</p>
              </div>
            </section>
          ) : (
            <PurchaseForm
              wallets={sim.wallets}
              draft={sim.draft}
              onChange={sim.update}
              result={sim.result}
              fieldError={sim.fieldError}
              onSeeImpact={isMobile ? () => setFormOpen(false) : undefined}
            />
          )}
        </aside>
        <div className={cn(MONTHLY_PANEL_MAIN_COLUMN_CLASS, 'xl:order-1')}>
          <PurchaseResults sim={sim} />
        </div>
      </div>
    </div>
  );
};
