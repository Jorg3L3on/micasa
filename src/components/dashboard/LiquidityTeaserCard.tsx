'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useFinanceContext } from '@/context/finance-context';
import { buildOwnerQuery } from '@/lib/api/client-fetch';
import { fetchLiquidityProjection } from '@/lib/api/liquidity';
import { formatCurrency, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { LiquidityProjectionResponse } from '@/types/catalog';

type LiquidityTeaserCardProps = {
  className?: string;
};

const LiquidityTeaserCard = ({ className }: LiquidityTeaserCardProps) => {
  const { context } = useFinanceContext();
  const [data, setData] = useState<LiquidityProjectionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const liquidityHref = useMemo(() => {
    const q = buildOwnerQuery(context).toString();
    return q ? `/wallets/liquidity?${q}` : '/wallets/liquidity';
  }, [context]);

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
        className={cn(
          'animate-pulse rounded-xl border border-border/60 bg-card p-6',
          className,
        )}
        role="status"
        aria-label="Cargando resumen de liquidez"
      >
        <div className="h-16 rounded-md bg-muted/40" />
      </div>
    );
  }

  if (!data) {
    return (
      <section
        className={cn(
          'flex flex-col rounded-xl border border-border/60 bg-card p-6',
          className,
        )}
        role="region"
        aria-label="Resumen de proyección de liquidez"
      >
        <h3 className="text-sm font-medium text-foreground">
          Liquidez vs obligaciones
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          No hay proyección disponible por ahora.
        </p>
      </section>
    );
  }

  const short = data.summary.shortfall_versus_funding > 0;

  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-border/60 bg-card p-6',
        className,
      )}
      role="region"
      aria-label="Resumen de proyección de liquidez"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium text-foreground">
            Liquidez vs obligaciones
          </h3>
          <p className="text-xs text-muted-foreground">
            Hasta {data.until} · efectivo/débito y pagos previstos
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 text-xs text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href={liquidityHref} aria-label="Ver proyección completa">
            Ver más
          </Link>
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">En cuentas</p>
          <p className="mt-1 font-mono text-base font-medium tabular-nums text-foreground">
            {formatCurrency(data.summary.funding_total)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Obligaciones</p>
          <p className="mt-1 font-mono text-base font-medium tabular-nums text-foreground">
            {formatCurrency(
              data.summary.total_obligations_due_on_or_before_until,
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">
            {short ? 'Falta' : 'Neto'}
          </p>
          <p
            className={cn(
              'mt-1 font-mono text-base font-medium tabular-nums',
              short && 'text-red-600 dark:text-red-400',
              !short &&
                data.summary.net_liquidity_versus_obligations >= 0 &&
                'text-green-600 dark:text-green-400',
            )}
          >
            {short
              ? formatCurrency(data.summary.shortfall_versus_funding)
              : formatCurrency(data.summary.net_liquidity_versus_obligations)}
          </p>
        </div>
      </div>
    </section>
  );
};

export default LiquidityTeaserCard;
