'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { LineChart, PieChart } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LiquidityProjectionTab } from '@/components/wallets/liquidity/LiquidityProjectionTab';
import { LiquidityInsightsTab } from '@/components/wallets/liquidity/LiquidityInsightsTab';

type LiquidityPageTab = 'proyeccion' | 'analisis';

const tabFromQuery = (raw: string | null): LiquidityPageTab =>
  raw === 'analisis' ? 'analisis' : 'proyeccion';

export default function LiquidityPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<LiquidityPageTab>(() =>
    tabFromQuery(searchParams.get('tab')),
  );

  useEffect(() => {
    setTab(tabFromQuery(searchParams.get('tab')));
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    const next = value as LiquidityPageTab;
    setTab(next);
    const nextParams = new URLSearchParams(searchParams.toString());
    if (next === 'proyeccion') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', next);
    }
    const qs = nextParams.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-black tracking-tight">Liquidez y análisis</h1>
        <p className="text-sm text-muted-foreground">
          Proyección a futuro y vista de patrones de gasto con tus saldos por cuenta.
        </p>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList
          variant="line"
          className="mb-4 h-11 w-full min-w-0 justify-start overflow-x-auto scrollbar-hide rounded-none border-b border-border/60 bg-transparent px-0"
        >
          <TabsTrigger
            value="proyeccion"
            className="shrink-0 gap-2 px-5 text-sm font-medium"
            aria-label="Proyección de liquidez"
          >
            <LineChart className="size-4 shrink-0" aria-hidden />
            Proyección
          </TabsTrigger>
          <TabsTrigger
            value="analisis"
            className="shrink-0 gap-2 px-5 text-sm font-medium"
            aria-label="Análisis e historial"
          >
            <PieChart className="size-4 shrink-0" aria-hidden />
            Análisis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proyeccion" className="mt-0">
          {tab === 'proyeccion' ? <LiquidityProjectionTab /> : null}
        </TabsContent>

        <TabsContent value="analisis" className="mt-0">
          {tab === 'analisis' ? <LiquidityInsightsTab /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
