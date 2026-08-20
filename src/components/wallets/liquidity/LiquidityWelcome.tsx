'use client';

import { useSession } from 'next-auth/react';
import { useFinanceContext } from '@/context/finance-context';
import { cn } from '@/lib/utils';

type LiquidityWelcomeProps = {
  activeTab: 'proyeccion' | 'analisis';
};

const STEPS = [
  { id: 'analisis' as const, label: 'Lo que ya pasó', hint: 'Tu historial' },
  { id: 'proyeccion' as const, label: 'Lo que viene', hint: 'Tu futuro' },
];

export const LiquidityWelcome = ({ activeTab }: LiquidityWelcomeProps) => {
  const { data: session } = useSession();
  const { context } = useFinanceContext();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0];
  const scopeLabel =
    context?.type === 'house' ? 'finanzas de tu casa' : 'tus finanzas';

  return (
    <div className="space-y-4">
      <div>
        {firstName ? (
          <p className="text-sm text-muted-foreground">Hola, {firstName}</p>
        ) : null}
        <h1 className="text-lg font-semibold leading-tight">Liquidez y análisis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Te mostramos {scopeLabel} en tres momentos: qué pasó, qué tienes hoy y qué viene.
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-card p-2"
        role="tablist"
        aria-label="Recorrido pasado y futuro"
      >
        {STEPS.map((step) => {
          const isActive = activeTab === step.id;
          return (
            <div
              key={step.id}
              role="tab"
              aria-selected={isActive}
              className={cn(
                'rounded-lg px-3 py-2 text-left transition-colors',
                isActive
                  ? 'border border-primary/30 bg-primary/10'
                  : 'border border-transparent bg-transparent opacity-70',
              )}
            >
              <p className="text-xs font-semibold text-foreground">{step.label}</p>
              <p className="text-[10px] text-muted-foreground">{step.hint}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
