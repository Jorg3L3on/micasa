'use client';

import { useState, type ComponentProps } from 'react';
import { FlaskConical } from 'lucide-react';
import { MONTHLY_PANEL_SHELL_CLASS, PANEL_INSET_CLASS } from '@/components/monthly/monthly-panel-shell';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import { SimulateLoanControl } from '@/components/wallets/liquidity/plan/SimulateLoanControl';
import { WhatIfPanel } from '@/components/wallets/liquidity/plan/WhatIfPanel';
import type { PlanMode } from '@/lib/finance/cash-plan/types';
import { cn } from '@/lib/utils';

type LoanFields = {
  rate: string;
  term: string;
  fee: string;
  onRateChange: (value: string) => void;
  onTermChange: (value: string) => void;
  onFeeChange: (value: string) => void;
  active: boolean;
  /** "Pago mensual $X × n · costo total $Y · lugar N en el orden", once the route exists. */
  result?: string | null;
};

type Tab = 'purchase' | 'instalment' | 'bridge' | 'consolidate';

type PlanSimulatorPanelProps = {
  mode: PlanMode;
  /** The "¿Y si…?" form; absent where the surface has no scenario. */
  whatIf?: Omit<ComponentProps<typeof WhatIfPanel>, 'bare' | 'kind'> | null;
  /** "Extra $A → $B · ruta: cambia", or the Proyección effect when the period does not move. */
  resultInset?: string | null;
  bridge: LoanFields;
  consolidate: LoanFields;
};

const ResultInset = ({ text }: { text: string }) => (
  <p className={cn(PANEL_INSET_CLASS, 'px-3 py-2.5 text-sm tabular-nums')} data-testid="sim-result" role="status">
    {text}
  </p>
);

/**
 * "Simula antes de decidir": one panel for the purchase and monthly-payment
 * scenario and, only when the period falls short, the bridge loan and
 * consolidation. Nothing is stored.
 */
export const PlanSimulatorPanel = ({ mode, whatIf, resultInset, bridge, consolidate }: PlanSimulatorPanelProps) => {
  const loans = mode === 'shortfall';
  const [chosen, setChosen] = useState<Tab>(whatIf?.active?.kind ?? 'purchase');
  const tab: Tab = !loans && (chosen === 'bridge' || chosen === 'consolidate') ? 'purchase' : chosen;
  const options = [
    ...(whatIf
      ? [
        { value: 'purchase', label: PLAN_COPY.simPurchase },
        { value: 'instalment', label: PLAN_COPY.simInstalment },
      ]
      : []),
    ...(loans
      ? [
        { value: 'bridge', label: PLAN_COPY.simBridge },
        { value: 'consolidate', label: PLAN_COPY.simConsolidate },
      ]
      : []),
  ];
  if (options.length === 0) return null;
  const shown: Tab = options.some((option) => option.value === tab) ? tab : (options[0]!.value as Tab);
  const loan = shown === 'bridge' ? bridge : shown === 'consolidate' ? consolidate : null;

  return (
    <section className={cn(MONTHLY_PANEL_SHELL_CLASS, 'space-y-4 p-4')} aria-labelledby="plan-sim-title">
      <div className="flex items-start gap-2">
        <FlaskConical className="mt-0.5 size-4 shrink-0 text-[color-mix(in_srgb,var(--chart-2)_70%,white)]" aria-hidden />
        <div className="min-w-0">
          <h3 id="plan-sim-title" className="text-sm font-semibold">{PLAN_COPY.simTitle}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{PLAN_COPY.simHint}</p>
        </div>
      </div>

      {options.length > 1 ? (
        <div
          role="tablist"
          aria-label={PLAN_COPY.simTabsLabel}
          className={cn(
            'grid gap-1 rounded-2xl border border-border/60 p-1',
            'grid-cols-2',
          )}
        >
          {options.map((option) => {
            const selected = option.value === shown;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setChosen(option.value as Tab)}
                className={cn(
                  'min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors',
                  selected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {loan ? (
        <div className="space-y-3">
          <SimulateLoanControl
            idPrefix={shown}
            title={shown === 'bridge' ? PLAN_COPY.bridgeTitle : PLAN_COPY.consolidateTitle}
            rate={loan.rate}
            term={loan.term}
            fee={loan.fee}
            onRateChange={loan.onRateChange}
            onTermChange={loan.onTermChange}
            onFeeChange={loan.onFeeChange}
            active={loan.active}
          />
          {loan.result ? <ResultInset text={loan.result} /> : null}
        </div>
      ) : whatIf ? (
        <div className="space-y-3">
          <WhatIfPanel {...whatIf} bare kind={shown === 'instalment' ? 'instalment' : 'purchase'} />
          {resultInset && whatIf.active && !whatIf.loading ? <ResultInset text={resultInset} /> : null}
        </div>
      ) : null}
    </section>
  );
};
