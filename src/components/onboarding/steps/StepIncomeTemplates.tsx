'use client';

import { useEffect, useState } from 'react';
import { Plus, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  AmountRow,
  GroupedRow,
  OVERLAY_ROW_INPUT_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
  OVERLAY_SECONDARY_BUTTON_CLASS,
  OverlayHint,
} from '@/components/overlay/overlay-form';
import {
  useOnboarding,
  type IncomeTemplateDraft,
} from '@/components/onboarding/OnboardingContext';
import { OnboardingItemCard } from '@/components/onboarding/OnboardingItemCard';
import {
  FORTNIGHT_FREQUENCY_OPTIONS,
  flagsFromFrequency,
  frequencyFromFlags,
  type FortnightFrequency,
} from '@/components/onboarding/fortnight-frequency';
import { createClientId } from '@/lib/polyfills';

export const incomesAreValid = (incomes: IncomeTemplateDraft[]): boolean =>
  incomes.length > 0 &&
  incomes.every(
    (income) =>
      income.name.trim() !== '' &&
      Number.isFinite(income.amount) &&
      income.amount > 0 &&
      income.walletId !== '',
  );

const IncomeLeading = () => (
  <span
    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-income-soft text-status-income"
    aria-hidden
  >
    <TrendingUp className="size-4" />
  </span>
);

export default function StepIncomeTemplates() {
  const {
    setCanProceed,
    incomeTemplates,
    setIncomeTemplates,
    wallets,
    defaultWalletId,
  } = useOnboarding();
  const [sourceOpen, setSourceOpen] = useState<Record<string, boolean>>({});

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
        {incomeTemplates.map((income) => {
          const nameId = `income-name-${income.id}`;
          const walletId = `income-wallet-${income.id}`;
          const frequencyId = `income-frequency-${income.id}`;
          const sourceId = `income-source-${income.id}`;
          const showSource = sourceOpen[income.id] || income.source !== '';

          return (
            <li key={income.id} className="flex flex-col gap-1.5">
              <OnboardingItemCard
                leading={<IncomeLeading />}
                title={income.name}
                subtitle="Ingreso"
                canDelete={incomeTemplates.length > 1}
                itemNoun="ingreso"
                onDelete={() => handleRemove(income.id)}
              >
                <AmountRow
                  id={`income-amount-${income.id}`}
                  label="Monto por quincena"
                  value={income.amount || ''}
                  onChange={(value) =>
                    updateIncome(income.id, {
                      amount: Number.isFinite(value) ? value : 0,
                    })
                  }
                />
                <GroupedRow label="Nombre" htmlFor={nameId}>
                  <Input
                    id={nameId}
                    value={income.name}
                    onChange={(event) =>
                      updateIncome(income.id, { name: event.target.value })
                    }
                    placeholder="Ej. Sueldo"
                    autoComplete="off"
                    className={OVERLAY_ROW_INPUT_CLASS}
                  />
                </GroupedRow>
                <GroupedRow label="Billetera" htmlFor={walletId}>
                  <Select
                    value={income.walletId}
                    onValueChange={(value) => updateIncome(income.id, { walletId: value })}
                  >
                    <SelectTrigger id={walletId} className={OVERLAY_ROW_TRIGGER_CLASS}>
                      <SelectValue placeholder="Dónde lo recibes" />
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map((wallet) => (
                        <SelectItem key={wallet.id} value={wallet.id}>
                          {wallet.name || 'Billetera sin nombre'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </GroupedRow>
                <GroupedRow label="Cuándo" htmlFor={frequencyId}>
                  <Select
                    value={frequencyFromFlags(income)}
                    onValueChange={(value) =>
                      updateIncome(
                        income.id,
                        flagsFromFrequency(value as FortnightFrequency),
                      )
                    }
                  >
                    <SelectTrigger id={frequencyId} className={OVERLAY_ROW_TRIGGER_CLASS}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORTNIGHT_FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </GroupedRow>
                {showSource ? (
                  <GroupedRow label="Quién paga" htmlFor={sourceId}>
                    <Input
                      id={sourceId}
                      value={income.source}
                      onChange={(event) =>
                        updateIncome(income.id, { source: event.target.value })
                      }
                      placeholder="Ej. Mi empleador (opcional)"
                      autoComplete="off"
                      className={OVERLAY_ROW_INPUT_CLASS}
                    />
                  </GroupedRow>
                ) : null}
              </OnboardingItemCard>

              {!showSource ? (
                <button
                  type="button"
                  onClick={() =>
                    setSourceOpen((prev) => ({ ...prev, [income.id]: true }))
                  }
                  className="self-start rounded-md px-1 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  Agregar quién te paga (opcional)
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <OverlayHint role="status">
        {incomeTemplates.some((income) => !(income.amount > 0))
          ? 'Escribe cuánto cobras para continuar. Un aproximado basta; lo ajustas cuando cobres.'
          : 'Monto aproximado por quincena. Lo ajustas cuando cobres.'}
      </OverlayHint>

      <Button
        type="button"
        variant="ghost"
        onClick={handleAdd}
        className={`${OVERLAY_SECONDARY_BUTTON_CLASS} text-primary-text`}
      >
        <Plus className="size-4" aria-hidden />
        Agregar otro ingreso
      </Button>
    </div>
  );
}
