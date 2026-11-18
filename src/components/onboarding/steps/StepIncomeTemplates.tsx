'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Button } from '@/components/ui/button';
import { OverlayHint } from '@/components/overlay/overlay-form';
import { PANEL_INSET_CLASS } from '@/components/monthly/monthly-panel-shell';
import {
  useOnboarding,
  type IncomeTemplateDraft,
  type WalletDraft,
} from '@/components/onboarding/OnboardingContext';
import { OnboardingDeletableRow } from '@/components/onboarding/OnboardingDeletableRow';
import { OnboardingChip, OnboardingFieldCaption } from '@/components/onboarding/OnboardingChip';
import {
  flagsFromFrequency,
  frequencyFromFlags,
} from '@/components/onboarding/fortnight-frequency';
import {
  INCOME_WHEN_CHIPS,
  monthlyIncomeEquivalent,
} from '@/components/onboarding/steps/onboarding-rows';
import { createClientId } from '@/lib/polyfills';
import { formatCurrency, cn } from '@/lib/utils';

export const incomesAreValid = (incomes: IncomeTemplateDraft[]): boolean =>
  incomes.length > 0 &&
  incomes.every(
    (income) =>
      income.name.trim() !== '' &&
      Number.isFinite(income.amount) &&
      income.amount > 0 &&
      income.walletId !== '',
  );

/** Same height as the canvas amount: a large figure the eye lands on first. */
const AMOUNT_INPUT_CLASS =
  'h-16 rounded-xl border-primary/60 bg-white/[0.05] pl-9 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums shadow-[0_0_0_4px_rgb(58_55_252_/_0.18)] md:text-[34px] dark:bg-white/[0.05]';

const DETAIL_INPUT_CLASS =
  'h-11 rounded-[10px] border-border/60 bg-white/[0.05] dark:border-white/10 dark:bg-white/[0.05]';

/** Income lands in cash or a debit account; a credit card is listed only if already picked. */
const incomeWalletChoices = (wallets: WalletDraft[], selectedId: string) =>
  wallets.filter((wallet) => wallet.type !== 'CREDIT' || wallet.id === selectedId);

function IncomeBlock({
  income,
  wallets,
  canDelete,
  onChange,
  onDelete,
}: {
  income: IncomeTemplateDraft;
  wallets: WalletDraft[];
  canDelete: boolean;
  onChange: (patch: Partial<IncomeTemplateDraft>) => void;
  onDelete: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const amountId = `income-amount-${income.id}`;
  const whenId = `income-when-${income.id}`;
  const whereId = `income-where-${income.id}`;
  const nameId = `income-name-${income.id}`;
  const sourceId = `income-source-${income.id}`;
  const frequency = frequencyFromFlags(income);
  const monthly = monthlyIncomeEquivalent(income.amount, frequency);
  const trimmedName = income.name.trim();
  // A nameless income cannot continue, so its name field never hides.
  const detailsForced = trimmedName === '';
  const showDetails = detailsOpen || detailsForced;

  return (
    <li className="flex flex-col gap-1.5">
      <OnboardingDeletableRow
        name={income.name}
        canDelete={canDelete}
        itemNoun="ingreso"
        onDelete={onDelete}
      >
        {(deleteButton) => (
          <div className={cn(PANEL_INSET_CLASS, 'flex flex-col gap-[18px] p-4 sm:px-[18px]')}>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <OnboardingFieldCaption htmlFor={amountId}>
                  {trimmedName || 'Ingreso'}, por quincena
                </OnboardingFieldCaption>
                {deleteButton}
              </div>
              <div className="flex">
                <CurrencyInput
                  id={amountId}
                  grouped
                  value={income.amount || ''}
                  onChange={(value) =>
                    onChange({ amount: Number.isFinite(value) ? value : 0 })
                  }
                  placeholder="0.00"
                  enterKeyHint="next"
                  className={AMOUNT_INPUT_CLASS}
                />
              </div>
              <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                {monthly > 0
                  ? `Unos ${formatCurrency(monthly)} al mes`
                  : 'Escribe cuánto cobras por quincena.'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <OnboardingFieldCaption id={whenId}>¿Cuándo lo recibes?</OnboardingFieldCaption>
              <div role="group" aria-labelledby={whenId} className="flex flex-wrap gap-2">
                {INCOME_WHEN_CHIPS.map((chip) => (
                  <OnboardingChip
                    key={chip.value}
                    selected={frequency === chip.value}
                    onClick={() => onChange(flagsFromFrequency(chip.value))}
                    className="flex-1 basis-28"
                  >
                    {chip.label}
                  </OnboardingChip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <OnboardingFieldCaption id={whereId}>¿Dónde lo recibes?</OnboardingFieldCaption>
              <div role="group" aria-labelledby={whereId} className="flex flex-wrap gap-2">
                {incomeWalletChoices(wallets, income.walletId).map((wallet) => (
                  <OnboardingChip
                    key={wallet.id}
                    selected={income.walletId === wallet.id}
                    onClick={() => onChange({ walletId: wallet.id })}
                  >
                    {wallet.name.trim() || 'Billetera sin nombre'}
                  </OnboardingChip>
                ))}
              </div>
            </div>

            {showDetails ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <OnboardingFieldCaption htmlFor={nameId}>Nombre</OnboardingFieldCaption>
                  <Input
                    id={nameId}
                    value={income.name}
                    onChange={(event) => onChange({ name: event.target.value })}
                    placeholder="Ej. Sueldo"
                    autoComplete="off"
                    aria-invalid={detailsForced || undefined}
                    className={DETAIL_INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <OnboardingFieldCaption htmlFor={sourceId}>
                    Quién te paga (opcional)
                  </OnboardingFieldCaption>
                  <Input
                    id={sourceId}
                    value={income.source}
                    onChange={(event) => onChange({ source: event.target.value })}
                    placeholder="Ej. Mi empleador"
                    autoComplete="off"
                    className={DETAIL_INPUT_CLASS}
                  />
                </div>
              </div>
            ) : null}

            {!detailsForced ? (
              <button
                type="button"
                aria-expanded={showDetails}
                onClick={() => setDetailsOpen((open) => !open)}
                className="min-h-11 self-start rounded-md text-[13px] font-medium text-muted-foreground underline underline-offset-[3px] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {showDetails ? 'Ocultar detalles' : 'Más detalles: nombre y quién te paga'}
              </button>
            ) : null}
          </div>
        )}
      </OnboardingDeletableRow>
      {detailsForced ? (
        <OverlayHint role="status">Ponle un nombre a este ingreso para continuar.</OverlayHint>
      ) : null}
    </li>
  );
}

export default function StepIncomeTemplates() {
  const {
    setCanProceed,
    incomeTemplates,
    setIncomeTemplates,
    wallets,
    defaultWalletId,
  } = useOnboarding();

  useEffect(() => {
    setCanProceed(incomesAreValid(incomeTemplates));
  }, [incomeTemplates, setCanProceed]);

  const updateIncome = (id: string, patch: Partial<IncomeTemplateDraft>) => {
    setIncomeTemplates((prev) =>
      prev.map((income) => (income.id === id ? { ...income, ...patch } : income)),
    );
  };

  const handleAdd = () => {
    setIncomeTemplates((prev) => [
      ...prev,
      {
        id: createClientId(),
        name: '',
        amount: 0,
        walletId: defaultWalletId,
        source: '',
        appliesFirstFortnight: true,
        appliesSecondFortnight: true,
      },
    ]);
  };

  const handleRemove = (id: string) => {
    setIncomeTemplates((prev) =>
      prev.length <= 1 ? prev : prev.filter((income) => income.id !== id),
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3" role="list">
        {incomeTemplates.map((income) => (
          <IncomeBlock
            key={income.id}
            income={income}
            wallets={wallets}
            canDelete={incomeTemplates.length > 1}
            onChange={(patch) => updateIncome(income.id, patch)}
            onDelete={() => handleRemove(income.id)}
          />
        ))}
      </ul>

      {incomeTemplates.some((income) => !(income.amount > 0)) ? (
        <OverlayHint role="status">
          Escribe cuánto cobras para continuar. Un aproximado basta; lo ajustas cuando cobres.
        </OverlayHint>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        onClick={handleAdd}
        className="min-h-11 w-full rounded-xl border border-dashed border-border/70 bg-white/[0.04] font-medium text-foreground hover:bg-foreground/[0.04] dark:border-white/20 dark:hover:bg-white/[0.08]"
      >
        <Plus className="size-4" aria-hidden />
        Agregar otro ingreso
      </Button>
    </div>
  );
}
