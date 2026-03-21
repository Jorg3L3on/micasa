'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { LineChart } from 'lucide-react';
import { useFinanceContext } from '@/context/finance-context';
import { fetchLiquidityProjection } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { LiquidityProjectionResponse } from '@/types/catalog';

/**
 * Resumen compacto de liquidez para el panel (carga en cliente).
 */
const LiquidityTeaserCard = () => {
  const { context } = useFinanceContext();
  const [data, setData] = useState<LiquidityProjectionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!context || (context.type === 'user' && context.id === 0)) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetchLiquidityProjection(
        { includeUnpaid: true, includeTemplates: false },
        context,
      );
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div
        className="rounded-lg border border-border/60 border-l-[3px] border-l-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/8 px-3 py-3 animate-pulse"
        role="status"
        aria-label="Cargando resumen de liquidez"
      >
        <div className="h-16 bg-muted/40 rounded-md" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const short = data.summary.shortfall_versus_funding > 0;

  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 border-l-[3px] px-3 py-3',
        short
          ? 'border-l-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10'
          : 'border-l-emerald-500/50 bg-emerald-500/5 dark:bg-emerald-500/8',
      )}
      role="region"
      aria-label="Resumen de proyección de liquidez"
    >
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
          <LineChart className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Liquidez vs obligaciones
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hasta {data.until} · efectivo/débito y pagos previstos
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="font-mono tabular-nums">
              <span className="text-muted-foreground text-[10px] uppercase block">
                Disponible
              </span>
              <span className="font-semibold">
                {formatCurrency(data.summary.funding_total)}
              </span>
            </span>
            <span className="font-mono tabular-nums">
              <span className="text-muted-foreground text-[10px] uppercase block">
                Obligaciones
              </span>
              <span className="font-semibold">
                {formatCurrency(
                  data.summary.total_obligations_due_on_or_before_until,
                )}
              </span>
            </span>
            <span className="font-mono tabular-nums">
              <span className="text-muted-foreground text-[10px] uppercase block">
                {short ? 'Falta' : 'Neto'}
              </span>
              <span
                className={cn(
                  'font-semibold',
                  short && 'text-destructive',
                  !short &&
                    data.summary.net_liquidity_versus_obligations >= 0 &&
                    'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {short
                  ? formatCurrency(data.summary.shortfall_versus_funding)
                  : formatCurrency(data.summary.net_liquidity_versus_obligations)}
              </span>
            </span>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link href="/wallets/liquidity" aria-label="Ver proyección completa">
              Ver proyección
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LiquidityTeaserCard;
