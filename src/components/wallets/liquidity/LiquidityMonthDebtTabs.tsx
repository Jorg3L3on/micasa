'use client';

import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LiquidityMonthDebtItemsList } from '@/components/wallets/liquidity/LiquidityMonthDebtItemsList';
import {
  monthDebtItemsTotal,
  monthDebtPaymentsTotal,
  type MonthDebtItem,
} from '@/lib/finance/liquidity-month-debt-items';

type LiquidityMonthDebtTabsProps = {
  items: MonthDebtItem[];
  outstandingTotal?: number;
};

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
    <Tabs defaultValue="outstanding" className="mt-4 w-full">
      <TabsList
        variant="line"
        className="h-9 w-full min-w-0 justify-start overflow-x-auto scrollbar-hide rounded-none border-b border-border/50 bg-transparent px-0"
      >
        <TabsTrigger
          value="outstanding"
          className="shrink-0 gap-1.5 px-3 text-xs font-medium sm:text-sm"
          aria-label={`Adeudo al cierre del mes, ${outstandingCount} conceptos`}
        >
          <span className="h-0.5 w-4 shrink-0 rounded-full bg-amber-400" aria-hidden />
          Adeudo al cierre
          {outstandingCount > 0 ? (
            <span className="tabular-nums text-muted-foreground">({outstandingCount})</span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger
          value="payments"
          className="shrink-0 gap-1.5 px-3 text-xs font-medium sm:text-sm"
          aria-label={`Deudas a pagar este mes, ${paymentCount} conceptos`}
        >
          <span
            className="h-0.5 w-4 shrink-0 rounded-full bg-gradient-to-r from-[#3a37fc] to-[#ee477a]"
            aria-hidden
          />
          Deudas del mes
          {paymentCount > 0 ? (
            <span className="tabular-nums text-muted-foreground">({paymentCount})</span>
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="outstanding" className="mt-3">
        <LiquidityMonthDebtItemsList
          items={items}
          mode="remaining"
          heading="Adeudo al cierre"
          totalLabel="Total adeudo"
          totalOverride={resolvedOutstandingTotal}
          emptyMessage="Ese mes no hay adeudo de tarjetas, tiendas ni préstamos."
        />
      </TabsContent>

      <TabsContent value="payments" className="mt-3">
        <LiquidityMonthDebtItemsList
          items={items}
          mode="payment"
          heading="Pagos del mes"
          totalLabel="Total del mes"
          totalOverride={paymentsTotal}
          emptyMessage="Ese mes no tienes pagos programados de deudas."
        />
      </TabsContent>
    </Tabs>
  );
};
