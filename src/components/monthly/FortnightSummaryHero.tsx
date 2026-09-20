'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Info } from 'lucide-react';
import { FortnightIncomeGauge } from '@/components/monthly/FortnightIncomeGauge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn, formatCurrency } from '@/lib/utils';

type FortnightSummaryHeroProps = {
  periodIncome: number;
  /** Ingresos menos pagado, pendiente y resto de presupuesto (vista planificación). */
  incomeRemainder: number;
  /** Saldos efectivo/débito menos pendiente, nómina y resto de presupuesto. */
  fundingNetInAccounts: number;
  /** Si false, se oculta la tarjeta de liquidez (solo aplica a quincena actual o siguiente). */
  fundingNetApplies?: boolean;
  /** Deducciones de nómina pendientes incluidas en incomeRemainder. */
  payrollDeductionAmount?: number;
  /** Resto del presupuesto de la quincena incluido en incomeRemainder / liquidez. */
  budgetRemainingAmount?: number;
  /** Pagado + pendiente + nómina (segmento del gauge distinto al presupuesto). */
  cashCommittedAmount?: number;
  showGauge: boolean;
};

const metricLabelClass =
  'min-w-0 text-[11px] font-semibold leading-snug text-muted-foreground sm:text-xs';

const leftoverHint =
  'De tus ingresos de esta quincena, esto es lo que todavía no está comprometido en pagos, pendientes ni presupuesto.';

const haveHint =
  'El efectivo y débito que tienes hoy, menos lo que aún debes pagar esta quincena.';

const budgetHint =
  'Lo que te queda por gastar del presupuesto de esta quincena.';

type MetricHintKey = 'leftover' | 'have' | 'budget';

type MetricCardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  hint: string;
  amount: number;
  amountClassName: string;
  dotClassName: string;
};

const MetricCard = ({
  open,
  onOpenChange,
  label,
  hint,
  amount,
  amountClassName,
  dotClassName,
}: MetricCardProps) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const skipClickRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    const handleDocumentPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      const content = document.querySelector('[data-slot="tooltip-content"]');
      if (content?.contains(target)) return;
      onOpenChange(false);
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown);
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown);
  }, [open, onOpenChange]);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    event.preventDefault();
    skipClickRef.current = true;
    onOpenChange(!open);
  };

  const handleClick = () => {
    if (skipClickRef.current) {
      skipClickRef.current = false;
      return;
    }
    onOpenChange(!open);
  };

  const handlePointerEnter = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse') return;
    onOpenChange(true);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'mouse') return;
    onOpenChange(false);
  };

  return (
    <Tooltip
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpenChange(true);
      }}
      delayDuration={0}
      disableHoverableContent
    >
      <TooltipTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className="appearance-none border-0 bg-transparent p-0 cursor-help touch-manipulation text-left shadow-none"
          aria-expanded={open}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          <div className="mb-1 flex items-start gap-1.5">
            <span
              className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', dotClassName)}
              aria-hidden
            />
            <span className={metricLabelClass}>{label}</span>
            <Info
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
              aria-hidden
              data-icon="inline-end"
            />
          </div>
          <p
            className={cn(
              'font-mono text-base font-bold tabular-nums sm:text-lg',
              amountClassName,
            )}
          >
            {formatCurrency(amount)}
          </p>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="max-w-[16rem] text-xs">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
};

export const FortnightSummaryHero = ({
  periodIncome,
  incomeRemainder,
  fundingNetInAccounts,
  fundingNetApplies = true,
  budgetRemainingAmount = 0,
  cashCommittedAmount = 0,
  showGauge,
}: FortnightSummaryHeroProps) => {
  const [openHint, setOpenHint] = useState<MetricHintKey | null>(null);

  const handleHintOpenChange = (key: MetricHintKey, nextOpen: boolean) => {
    setOpenHint((current) => {
      if (nextOpen) return key;
      if (current === key) return null;
      return current;
    });
  };

  const gauge = showGauge ? (
    <FortnightIncomeGauge
      cashCommitted={cashCommittedAmount}
      budgetRemaining={budgetRemainingAmount}
      periodIncome={periodIncome}
      className="mx-auto shrink-0 lg:mx-0"
    />
  ) : null;

  const showBudgetAvailable = budgetRemainingAmount > 0;
  const metricCount =
    1 + (fundingNetApplies ? 1 : 0) + (showBudgetAvailable ? 1 : 0);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
      {gauge ? <div className="flex justify-center lg:hidden">{gauge}</div> : null}

      <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:gap-5">
        {gauge ? (
          <div className="hidden shrink-0 lg:block">{gauge}</div>
        ) : null}

        <div
          className={cn(
            'grid min-w-0 flex-1 gap-2 sm:gap-3',
            metricCount >= 3
              ? 'grid-cols-2 sm:grid-cols-3'
              : metricCount === 2
                ? 'grid-cols-2'
                : 'grid-cols-1',
          )}
        >
          <MetricCard
            open={openHint === 'leftover'}
            onOpenChange={(nextOpen) => handleHintOpenChange('leftover', nextOpen)}
            label="Lo que te queda"
            hint={leftoverHint}
            amount={incomeRemainder}
            dotClassName="bg-teal-500 dark:bg-[#2dd4bf]"
            amountClassName={
              incomeRemainder >= 0
                ? 'text-foreground'
                : 'text-destructive'
            }
          />

          {fundingNetApplies ? (
            <MetricCard
              open={openHint === 'have'}
              onOpenChange={(nextOpen) => handleHintOpenChange('have', nextOpen)}
              label="Lo que tienes"
              hint={haveHint}
              amount={fundingNetInAccounts}
              dotClassName="bg-emerald-500"
              amountClassName={
                fundingNetInAccounts < 0
                  ? 'text-destructive'
                  : 'text-emerald-700 dark:text-emerald-300'
              }
            />
          ) : null}

          {showBudgetAvailable ? (
            <MetricCard
              open={openHint === 'budget'}
              onOpenChange={(nextOpen) => handleHintOpenChange('budget', nextOpen)}
              label="Del presupuesto"
              hint={budgetHint}
              amount={budgetRemainingAmount}
              dotClassName="bg-violet-500 dark:bg-[#c4b5fd]"
              amountClassName="text-foreground"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
