'use client';

import { useMemo } from 'react';
import { CalendarClock, Landmark } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/motion/tabs';
import { Badge } from '@/components/ui/badge';
import {
  AURA_TAB_INDICATOR_CLASS,
  GLASS_TAB_ACTIVE_LABEL_CLASS,
  MONTHLY_LIQUID_PANEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { LiquidityMonthDebtItemsList } from '@/components/wallets/liquidity/LiquidityMonthDebtItemsList';
import {
  monthDebtItemsTotal,
  monthDebtPaymentsTotal,
  type MonthDebtItem,
} from '@/lib/finance/liquidity-month-debt-items';
import { cn } from '@/lib/utils';

type LiquidityMonthDebtTabsProps = {
  items: MonthDebtItem[];
  outstandingTotal?: number;
};

const TAB_TRIGGER_CLASS =
  'min-h-9 px-1.5 py-1.5 text-xs font-semibold sm:min-h-8 sm:px-2 sm:py-1.5 xl:px-2.5 xl:py-2 xl:text-sm';
const TAB_LABEL_CLASS = 'inline-flex min-w-0 items-center justify-center gap-1 sm:gap-1.5';
const TAB_ICON_CLASS = 'h-3.5 w-3.5 shrink-0';
const TAB_BADGE_CLASS =
  'pointer-events-none h-4 min-w-4 shrink-0 justify-center rounded-full border-0 px-1 text-xs font-mono font-semibold tabular-nums shadow-none xl:h-5 xl:min-w-5.5 xl:px-1.5';

const countPayments = (items: readonly MonthDebtItem[]): number =>
  items.filter((item) => (item.payment_amount ?? 0) > 0).length;

const countOutstanding = (items: readonly MonthDebtItem[]): number =>
  items.filter((item) => item.amount > 0).length;

export const LiquidityMonthDebtTabs = ({
  items,
  outstandingTotal,
}: LiquidityMonthDebtTabsProps) => {
  const paymentCount = useMemo(() => countPayments(items), [items]);
  const outstandingCount = useMemo(() => countOutstanding(items), [items]);
  const resolvedOutstandingTotal = outstandingTotal ?? monthDebtItemsTotal(items);
  const paymentsTotal = monthDebtPaymentsTotal(items);

  return (
    <Tabs defaultValue="payments" variant="pill" className="w-full min-w-0">
      <div
        className={cn(
          MONTHLY_LIQUID_PANEL_CLASS,
          'mb-1.5 flex min-w-0 items-center gap-1 p-1 sm:mb-3.5 sm:gap-1.5 sm:p-1.5',
        )}
      >
        <TabsList
          aria-label="Deudas del mes"
          wrapperClassName="min-w-0 flex-1"
          className="w-full gap-0.5 bg-transparent p-0 sm:gap-1"
        >
          <TabsTrigger
            value="payments"
            stretch
            className={TAB_TRIGGER_CLASS}
            indicatorClassName={AURA_TAB_INDICATOR_CLASS}
            activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
            aria-label={`Pagos del mes, ${paymentCount} conceptos`}
          >
            <span className={TAB_LABEL_CLASS}>
              <CalendarClock className={TAB_ICON_CLASS} aria-hidden />
              Pagos del mes
              <Badge
                variant={paymentCount > 0 ? 'default' : 'secondary'}
                className={TAB_BADGE_CLASS}
                aria-hidden
              >
                {paymentCount}
              </Badge>
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="outstanding"
            stretch
            className={TAB_TRIGGER_CLASS}
            indicatorClassName={AURA_TAB_INDICATOR_CLASS}
            activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
            aria-label={`Adeudo al cierre del mes, ${outstandingCount} conceptos`}
          >
            <span className={TAB_LABEL_CLASS}>
              <Landmark className={TAB_ICON_CLASS} aria-hidden />
              Adeudo al cierre
              <Badge
                variant={outstandingCount > 0 ? 'default' : 'secondary'}
                className={TAB_BADGE_CLASS}
                aria-hidden
              >
                {outstandingCount}
              </Badge>
            </span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="payments" className="mt-0 outline-none">
        <LiquidityMonthDebtItemsList
          items={items}
          mode="payment"
          totalLabel="Total del mes"
          totalOverride={paymentsTotal}
          emptyMessage="Ese mes no tienes pagos programados de deudas."
        />
      </TabsContent>
      <TabsContent value="outstanding" className="mt-0 outline-none">
        <LiquidityMonthDebtItemsList
          items={items}
          mode="remaining"
          totalLabel="Total adeudo"
          totalOverride={resolvedOutstandingTotal}
          emptyMessage="Ese mes no hay adeudo de tarjetas, tiendas ni préstamos."
        />
      </TabsContent>
    </Tabs>
  );
};
