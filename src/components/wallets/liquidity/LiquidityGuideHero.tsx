'use client';

import { useSession } from 'next-auth/react';
import { Sparkles } from 'lucide-react';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import { cn } from '@/lib/utils';
import {
  buildLiquidityHeroCopy,
  getLiquidityHealth,
} from '@/components/wallets/liquidity/liquidity-personalization';
import { LiquidityFundingWalletsMenu } from '@/components/wallets/liquidity/LiquidityFundingWalletsMenu';

type LiquidityGuideHeroProps = {
  data: LiquidityProjectionResponse | null;
  horizonMonths?: import('@/components/wallets/liquidity/liquidity-personalization').LiquidityHorizonMonths;
  onAccountsChanged?: () => void;
};

const toneClasses = {
  emerald: {
    shell: 'border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10',
    icon: 'bg-emerald-500/15 ring-emerald-500/25 text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300',
  },
  amber: {
    shell: 'border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10',
    icon: 'bg-amber-500/15 ring-amber-500/25 text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:text-amber-300',
  },
  destructive: {
    shell: 'border-destructive/25 bg-destructive/5 dark:bg-destructive/10',
    icon: 'bg-destructive/15 ring-destructive/25 text-destructive',
    badge: 'bg-destructive/10 text-destructive ring-destructive/20',
  },
} as const;

export const LiquidityGuideHero = ({
  data,
  horizonMonths = 6,
  onAccountsChanged,
}: LiquidityGuideHeroProps) => {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0];

  if (!data) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card px-4 py-4 shadow-sm">
        <p className="text-sm text-muted-foreground">
          Preparando tu panorama de dinero…
        </p>
      </div>
    );
  }

  const copy = buildLiquidityHeroCopy(data, firstName, horizonMonths);
  const tone = toneClasses[copy.tone];
  const health = getLiquidityHealth(data);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-2xl border px-4 py-4 shadow-sm sm:flex-row sm:items-start',
        tone.shell,
      )}
      role="region"
      aria-label="Tu panorama de dinero"
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1',
          tone.icon,
        )}
      >
        <Sparkles className="h-5 w-5" aria-hidden data-icon="inline-start" />
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold leading-tight">{copy.title}</h2>
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1',
              tone.badge,
            )}
          >
            {copy.badge}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
        <p className="text-xs text-muted-foreground">
          {health === 'healthy'
            ? 'Toca un mes en la gráfica para ver ese detalle. Los puntos verdes son cuando terminas de pagar algo.'
            : 'Toca un punto verde en la gráfica; ese es el mes en que terminas de pagar algo.'}
        </p>
      </div>

      <div className="shrink-0 self-start">
        <LiquidityFundingWalletsMenu onChanged={onAccountsChanged} />
      </div>
    </div>
  );
};
