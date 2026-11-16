'use client';

import { useMemo } from 'react';
import { Money } from '@/components/money';
import { FortnightProgressTrack } from '@/components/monthly/MonthlyChromeHeader';
import { PANEL_INSET_CLASS } from '@/components/monthly/monthly-panel-shell';
import { useOnboarding } from '@/components/onboarding/OnboardingContext';
import {
  committedBarPercent,
  computeOnboardingPreview,
  type OnboardingPreview,
  type QuincenaPreview,
} from '@/components/onboarding/onboarding-preview';
import { cn, formatCurrency } from '@/lib/utils';

/**
 * Extension points of the wizard shell. Both render inside
 * `OnboardingProvider` and recompute from the drafts on every change (no
 * request). The wizard hides each wrapper while its slot renders nothing.
 *
 * - `OnboardingAsidePreviewSlot`: bottom of the desktop aside (≥781px), under
 *   the stepper: the "Tu quincena hasta ahora" / "Te queda libre" card.
 * - `OnboardingPhoneStripSlot`: phones only (<781px), directly above the footer
 *   buttons: the "Libre en la 1ª / 2ª" strip, from the Ingresos step on.
 */

/** Wizard step index of Ingresos (Billeteras is 0). */
const INCOME_STEP_INDEX = 1;
/** Wizard step index of Gastos fijos. */
const EXPENSES_STEP_INDEX = 2;

const useOnboardingPreview = (): OnboardingPreview => {
  const { wallets, incomeTemplates, expenseTemplates } = useOnboarding();
  return useMemo(
    () => computeOnboardingPreview({ wallets, incomeTemplates, expenseTemplates }),
    [wallets, incomeTemplates, expenseTemplates],
  );
};

const EYEBROW_CLASS =
  'text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground';

const committedCaption = (row: QuincenaPreview): string =>
  row.percentCommitted === null
    ? `${formatCurrency(row.fixedCosts)} en gastos fijos, sin ingreso en esta quincena`
    : `${formatCurrency(row.fixedCosts)} en gastos fijos, ${row.percentCommitted}% de tu ingreso`;

const QuincenaRow = ({
  label,
  row,
  showCosts,
}: {
  label: string;
  row: QuincenaPreview;
  showCosts: boolean;
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <Money value={row.free} tone="neutral" className="text-lg font-bold" />
    </div>
    <FortnightProgressTrack
      percent={showCosts ? committedBarPercent(row) : 0}
      tone="complete"
      label={`Gastos fijos de la ${label}`}
    />
    {showCosts ? (
      <p className="text-xs leading-[1.45] text-muted-foreground tabular-nums">
        {committedCaption(row)}
      </p>
    ) : null}
  </div>
);

export const OnboardingAsidePreviewSlot = () => {
  const { currentStep } = useOnboarding();
  const preview = useOnboardingPreview();

  if (!preview.hasIncome) {
    return (
      <section
        aria-label="Tu quincena hasta ahora"
        className={cn(PANEL_INSET_CLASS, 'flex flex-col gap-2.5 px-4 py-3.5')}
      >
        <p className={EYEBROW_CLASS}>Tu quincena hasta ahora</p>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-muted-foreground">Balance hoy</span>
          <Money
            value={preview.balanceToday}
            tone="neutral"
            className="text-xl font-bold"
          />
        </div>
        <div className="h-px bg-white/[0.08]" aria-hidden />
        <div className="flex items-baseline justify-between gap-3 text-[13px] text-muted-foreground">
          <span>Te queda libre</span>
          <span>Falta tu ingreso</span>
        </div>
      </section>
    );
  }

  const showCosts = preview.hasFixedCosts;

  return (
    <section
      aria-label="Tu quincena hasta ahora"
      className={cn(
        PANEL_INSET_CLASS,
        'flex flex-col px-4 py-3.5',
        showCosts ? 'gap-3.5' : 'gap-3',
      )}
    >
      <p className={EYEBROW_CLASS}>Te queda libre</p>
      <QuincenaRow label="1ª quincena" row={preview.first} showCosts={showCosts} />
      <QuincenaRow label="2ª quincena" row={preview.second} showCosts={showCosts} />
      {showCosts ? null : (
        <p className="text-xs leading-[1.45] text-muted-foreground">
          {currentStep < EXPENSES_STEP_INDEX
            ? 'Aún sin gastos fijos. Los agregas en el siguiente paso.'
            : 'Aún sin gastos fijos.'}
        </p>
      )}
    </section>
  );
};

const StripTile = ({ label, value }: { label: string; value: number }) => (
  <div className={cn(PANEL_INSET_CLASS, 'min-w-0 px-2.5 py-2 min-[360px]:px-3')}>
    <p className="text-xs leading-[1.45] text-muted-foreground">{label}</p>
    <Money
      value={value}
      tone="neutral"
      className="block text-[15px] font-bold min-[360px]:text-[17px]"
    />
  </div>
);

export const OnboardingPhoneStripSlot = () => {
  const { currentStep } = useOnboarding();
  const preview = useOnboardingPreview();

  if (currentStep < INCOME_STEP_INDEX || !preview.hasIncome) return null;

  return (
    <div
      aria-label="Te queda libre por quincena"
      role="group"
      className="grid grid-cols-2 gap-2"
    >
      <StripTile label="Libre en la 1ª" value={preview.first.free} />
      <StripTile label="Libre en la 2ª" value={preview.second.free} />
    </div>
  );
};
