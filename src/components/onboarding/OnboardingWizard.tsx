'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AppAtmosphere } from '@/components/app-atmosphere';
import { OnboardingProvider, useOnboarding } from '@/components/onboarding/OnboardingContext';
import { MONTHLY_PANEL_SHELL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/error-banner';
import { cn } from '@/lib/utils';
import StepWelcome from '@/components/onboarding/steps/StepWelcome';
import StepWallets from '@/components/onboarding/steps/StepWallets';
import StepIncomeTemplates from '@/components/onboarding/steps/StepIncomeTemplates';
import StepExpenseTemplates from '@/components/onboarding/steps/StepExpenseTemplates';
import StepFortnights from '@/components/onboarding/steps/StepFortnights';
import { getAppHomeHref } from '@/lib/fortnight-calendar';
import type {
  ExpenseTemplateDraft,
  IncomeTemplateDraft,
  WalletDraft,
} from '@/components/onboarding/OnboardingContext';

const steps = [
  StepWelcome,
  StepWallets,
  StepIncomeTemplates,
  StepExpenseTemplates,
  StepFortnights,
] as const;

const stepTitles: Record<number, string> = {
  0: 'Bienvenido a MiCasa',
  1: 'Billeteras',
  2: 'Plantillas de ingresos',
  3: 'Plantillas de gastos',
  4: 'Quincenas',
};

const stepDescriptions: Record<number, string> = {
  0: 'Configura tu cuenta en menos de un minuto.',
  1: '',
  2: '',
  3: '',
  4: '',
};

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
  const StepComponent = steps[currentStep];
  const progress = (currentStep + 1) / totalSteps;
  const title = stepTitles[currentStep] ?? `Paso ${currentStep + 1}`;
  const description = stepDescriptions[currentStep];

  const router = useRouter();
  const [finishError, setFinishError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const stepContentTransition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: SOFT_EASE };

  const handleFinish = async () => {
    setFinishError(null);
    try {
      setStepLoading(true);

      const startDate =
        typeof onboarding.startDate === 'string'
          ? onboarding.startDate
          : null;

      const onboardingPayload: {
        wallets: WalletDraft[];
        incomeTemplates: IncomeTemplateDraft[];
        expenseTemplates: ExpenseTemplateDraft[];
        startDate: string | null;
      } = {
        wallets: onboarding.wallets ?? [],
        incomeTemplates: onboarding.incomeTemplates ?? [],
        expenseTemplates: onboarding.expenseTemplates ?? [],
        startDate,
      };

      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(onboardingPayload),
      });

      if (response.ok) {
        router.push(getAppHomeHref());
        return;
      }

      const errorBody = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      console.error('Onboarding completion failed:', response.status, errorBody);
      setFinishError(
        errorBody?.message ?? 'No pudimos crear tu panel. Inténtalo de nuevo.',
      );
    } catch (error) {
      console.error('Onboarding completion error', error);
      setFinishError(
        'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
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

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-background px-4 py-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <AppAtmosphere />
      <div className={cn(MONTHLY_PANEL_SHELL_CLASS, 'relative z-10 w-full max-w-[640px] motion-slide-up')}>
        <div className="space-y-5 px-5 pt-6 pb-2 sm:px-8">
            <div className="space-y-2">
              <p className="text-caption text-muted-foreground">
                Paso {currentStep + 1} de {totalSteps}
              </p>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
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
              <h1 className="text-title text-foreground">{title}</h1>
              {description ? (
                <p className="text-body text-muted-foreground">{description}</p>
              ) : null}
            </div>
        </div>

        <div className="min-h-[120px] px-5 pt-4 sm:px-8">
            <AnimatePresence mode="wait">
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
          <div className="px-5 pb-4 sm:px-8">
            <ErrorBanner>{finishError}</ErrorBanner>
          </div>
        ) : null}

        <div className="flex w-full gap-3 border-t border-border/60 px-5 py-5 sm:px-8">
            {!isFirstStep && (
              <Button
                type="button"
                variant="ghost"
                onClick={goBack}
                disabled={isStepLoading}
                aria-label="Ir al paso anterior"
              >
                Atrás
              </Button>
            )}
            <Button
              type="button"
              onClick={handleNext}
              className="ml-auto"
              disabled={isStepLoading || !canProceed}
              aria-label="Continuar al siguiente paso"
            >
              {isStepLoading
                ? 'Preparando tu espacio financiero…'
                : isLastStep
                  ? 'Finalizar'
                  : 'Continuar'}
            </Button>
        </div>
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
