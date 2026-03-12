'use client';

import { useEffect, useMemo } from 'react';
import { useOnboarding } from '@/components/onboarding/OnboardingContext';

type Props = {
  setCanProceed?: (value: boolean) => void;
};

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

export default function StepFinish({ setCanProceed }: Props) {
  const onboarding = useOnboarding() as any;

  const setProceed: (value: boolean) => void =
    setCanProceed ?? onboarding.setCanProceed;

  const wallets = (onboarding.wallets ?? []) as { name?: string }[];
  const categories = (onboarding.categories ?? []) as { name?: string }[];
  const incomeTemplates = (onboarding.incomeTemplates ?? []) as {
    name?: string;
  }[];
  const expenseTemplates = (onboarding.expenseTemplates ?? []) as {
    name?: string;
  }[];
  const rawStartDate = onboarding.startDate as string | null | undefined;

  const startDate: Date | null = useMemo(() => {
    if (!rawStartDate) return null;
    const parsed = new Date(rawStartDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [rawStartDate]);

  const formattedStartDate = startDate
    ? dateFormatter.format(startDate)
    : 'Sin fecha de inicio definida';

  useEffect(() => {
    setProceed(true);
  }, [setProceed]);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('Onboarding start date:', startDate);
  }, [startDate]);

  return (
    <div className="space-y-6">
      {/* Section 1 — Title & explanation */}
      <div className="space-y-2">
        <h3 className="text-foreground text-lg font-semibold">Todo está listo</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Tu espacio financiero ya está configurado. Hemos preparado tus
          billeteras, categorías e ingresos y gastos recurrentes. Tus finanzas
          se organizarán en ciclos de 14 días para que puedas ver claramente tu
          dinero disponible en cada periodo.
        </p>
      </div>

      {/* Section 2 — Configuration summary */}
      <div className="space-y-4">
        <section className="space-y-2 rounded-lg border p-4">
          <h4 className="text-muted-foreground text-sm font-semibold">
            Billeteras
          </h4>
          {wallets.length ? (
            <ul role="list" className="space-y-1 text-sm">
              {wallets.map((wallet, index) => (
                <li key={index} role="listitem">
                  {wallet.name ?? 'Sin nombre'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No se configuraron billeteras.
            </p>
          )}
        </section>

        <section className="space-y-2 rounded-lg border p-4">
          <h4 className="text-muted-foreground text-sm font-semibold">
            Categorías
          </h4>
          {categories.length ? (
            <ul role="list" className="space-y-1 text-sm">
              {categories.map((category, index) => (
                <li key={index} role="listitem">
                  {category.name ?? 'Sin nombre'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No se configuraron categorías.
            </p>
          )}
        </section>

        <section className="space-y-2 rounded-lg border p-4">
          <h4 className="text-muted-foreground text-sm font-semibold">
            Plantillas de ingreso
          </h4>
          {incomeTemplates.length ? (
            <ul role="list" className="space-y-1 text-sm">
              {incomeTemplates.map((income, index) => (
                <li key={index} role="listitem">
                  {income.name ?? 'Sin nombre'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No se configuraron plantillas de ingreso.
            </p>
          )}
        </section>

        <section className="space-y-2 rounded-lg border p-4">
          <h4 className="text-muted-foreground text-sm font-semibold">
            Plantillas de gasto
          </h4>
          {expenseTemplates.length ? (
            <ul role="list" className="space-y-1 text-sm">
              {expenseTemplates.map((expense, index) => (
                <li key={index} role="listitem">
                  {expense.name ?? 'Sin nombre'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              No se configuraron plantillas de gasto.
            </p>
          )}
        </section>
      </div>

      {/* Section 3 — Start date summary */}
      <section className="space-y-2 rounded-lg border p-4">
        <h4 className="text-muted-foreground text-sm font-semibold">
          Inicio de tus ciclos financieros
        </h4>
        <p className="text-sm">{formattedStartDate}</p>
      </section>

      {/* Optional microcopy shown while finishing onboarding */}
      {onboarding.isStepLoading && (
        <p className="text-muted-foreground text-xs">
          Preparando tu espacio financiero...
        </p>
      )}
    </div>
  );
}
