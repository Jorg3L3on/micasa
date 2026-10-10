'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AppAtmosphere } from '@/components/app-atmosphere';
import {
  OnboardingProvider,
  useOnboarding,
} from '@/components/onboarding/OnboardingContext';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/error-banner';
import { cn } from '@/lib/utils';
import StepWallets from '@/components/onboarding/steps/StepWallets';
import StepIncomeTemplates from '@/components/onboarding/steps/StepIncomeTemplates';
import StepExpenseTemplates from '@/components/onboarding/steps/StepExpenseTemplates';
import StepSummary from '@/components/onboarding/steps/StepSummary';
import { getAppHomeHref } from '@/lib/fortnight-calendar';
import type { OnboardingCompletePayload } from '@/schemas/onboarding.schema';

type StepMeta = {
  Component: () => React.ReactNode;
  /** Short name used for "Siguiente: …". */
  name: string;
  title: string;
  description: string;
};

const STEPS: StepMeta[] = [
  {
    Component: StepWallets,
    name: 'Billeteras',
    title: '¿Dónde guardas tu dinero?',
    description:
      'Primero tus billeteras, después tus ingresos y gastos fijos. Edita los nombres y elige tu banco.',
  },
  {
    Component: StepIncomeTemplates,
    name: 'Ingresos',
    title: '¿Cuánto cobras por quincena?',
    description: 'Con esto calculamos cuánto te queda libre en cada quincena.',
  },
  {
    Component: StepExpenseTemplates,
    name: 'Gastos',
    title: '¿Qué pagas cada quincena?',
    description:
      'Toca un gasto para agregarlo y escribe cuánto pagas. Puedes omitir este paso.',
  },
  {
    Component: StepSummary,
    name: 'Resumen',
    title: 'Todo listo',
    description: 'Revisa lo que vamos a crear. Puedes cambiar todo después.',
  },
];

const stepContentVariants = {
  enter: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
};

const SOFT_EASE = [0.22, 1, 0.36, 1] as const;

function OnboardingWizardContent() {
  const onboarding = useOnboarding();
  const {
    currentStep,
    totalSteps,
    goNext,
    goBack,
    isFirstStep,
    isLastStep,
    isStepLoading,
    setStepLoading,
    canProceed,
  } = onboarding;
  const step = STEPS[currentStep];
  const nextStep = STEPS[currentStep + 1];
  const StepComponent = step.Component;
  const progress = (currentStep + 1) / totalSteps;

  const router = useRouter();
  const [finishError, setFinishError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const stepContentTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: SOFT_EASE };

  // Each step starts at the top of the scroll region.
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [currentStep]);

  const handleBack = () => {
    setFinishError(null);
    goBack();
  };

  const handleFinish = async () => {
    setFinishError(null);
    setStepLoading(true);
    try {
      const payload: OnboardingCompletePayload = {
        wallets: onboarding.wallets.map((wallet) => ({
          ...wallet,
          name: wallet.name.trim(),
        })),
        incomeTemplates: onboarding.incomeTemplates.map((income) => ({
          ...income,
          name: income.name.trim(),
          source: income.source.trim(),
        })),
        expenseTemplates: onboarding.expenseTemplates.map((expense) => ({
          ...expense,
          name: expense.name.trim(),
        })),
        startDate: onboarding.startDate,
      };

      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.push(getAppHomeHref('welcome=1'));
        return;
      }

      const errorBody = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      console.error('Onboarding completion failed:', response.status, errorBody);
      setFinishError(
        errorBody?.message ?? 'No pudimos crear tu panel. Inténtalo de nuevo.',
      );
      setStepLoading(false);
    } catch (error) {
      console.error('Onboarding completion error', error);
      setFinishError(
        'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      );
      setStepLoading(false);
    }
  };

  const handleNext = () => {
    if (isLastStep) {
      void handleFinish();
      return;
    }
    goNext();
  };

  const primaryLabel = isLastStep
    ? isStepLoading
      ? 'Creando tu panel…'
      : 'Crear mi panel'
    : 'Continuar';

  return (
    <div className="relative flex h-dvh flex-col items-center justify-start overflow-hidden bg-background px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:justify-center sm:py-8">
      <AppAtmosphere />
      <div
        className={cn(
          MONTHLY_PANEL_SHELL_CLASS,
          'relative z-10 flex max-h-full min-h-0 w-full max-w-xl flex-col motion-slide-up',
        )}
      >
        <header className="shrink-0 space-y-4 px-5 pt-5 pb-4 sm:px-8 sm:pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-caption text-muted-foreground">
              <span>
                Paso {currentStep + 1} de {totalSteps}
              </span>
              {nextStep ? <span>Siguiente: {nextStep.name}</span> : null}
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Paso ${currentStep + 1} de ${totalSteps}`}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-(--motion-base) ease-(--ease-out-soft) motion-reduce:transition-none"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-title text-foreground">{step.title}</h1>
            <p className="text-body text-muted-foreground">{step.description}</p>
          </div>
        </header>

        <div
          ref={bodyRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-6 sm:px-8"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={currentStep}
              variants={stepContentVariants}
              initial="enter"
              animate="animate"
              exit="exit"
              transition={stepContentTransition}
              className="w-full"
            >
              <StepComponent />
            </motion.div>
          </AnimatePresence>
        </div>

        {finishError ? (
          <div className="shrink-0 px-5 pb-3 sm:px-8">
            <ErrorBanner>{finishError}</ErrorBanner>
          </div>
        ) : null}

        <footer className="flex shrink-0 items-center gap-3 border-t border-border/60 px-5 py-4 sm:px-8">
          {!isFirstStep ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleBack}
              disabled={isStepLoading}
              className="h-11 rounded-xl px-3 text-primary-text"
            >
              Atrás
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={handleNext}
            className="ml-auto h-11 min-w-36 rounded-xl"
            disabled={isStepLoading || !canProceed}
          >
            {primaryLabel}
          </Button>
        </footer>
      </div>
    </div>
  );
}

export default function OnboardingWizard() {
  return (
    <OnboardingProvider>
      <OnboardingWizardContent />
    </OnboardingProvider>
  );
}
