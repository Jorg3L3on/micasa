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
import { MicasaMark } from '@/components/brand/micasa-mark';
import {
  OnboardingProgressBar,
  OnboardingStepper,
} from '@/components/onboarding/OnboardingStepper';
import {
  OnboardingAsidePreviewSlot,
  OnboardingPhoneStripSlot,
} from '@/components/onboarding/OnboardingSlots';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/error-banner';
import { OnboardingSkipAction } from '@/components/onboarding/OnboardingSkipAction';
import { summaryTitle } from '@/components/onboarding/steps/onboarding-summary';
import { cn } from '@/lib/utils';
import StepWallets from '@/components/onboarding/steps/StepWallets';
import StepIncomeTemplates from '@/components/onboarding/steps/StepIncomeTemplates';
import StepExpenseTemplates from '@/components/onboarding/steps/StepExpenseTemplates';
import StepSummary from '@/components/onboarding/steps/StepSummary';
import { getAppHomeHref } from '@/lib/fortnight-calendar';
import type { OnboardingCompletePayload } from '@/schemas/onboarding.schema';

type StepMeta = {
  Component: () => React.ReactNode;
  /** Short name for the stepper and "Sigue: …". */
  name: string;
  /** A function receives the account name (Resumen greets by first name). */
  title: string | ((userName: string) => string);
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
    name: 'Gastos fijos',
    title: '¿Qué pagas cada quincena?',
    description: 'Toca lo que pagas y escribe cuánto. Puedes omitir este paso.',
  },
  {
    Component: StepSummary,
    name: 'Resumen',
    title: summaryTitle,
    description: 'Después de tus gastos fijos. Puedes cambiar todo desde tu panel.',
  },
];

const STEP_NAMES = STEPS.map((step) => step.name);

const stepContentVariants = {
  enter: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
};

const SOFT_EASE = [0.22, 1, 0.36, 1] as const;

function OnboardingWizardContent({ userName }: { userName: string }) {
  const onboarding = useOnboarding();
  const {
    currentStep,
    goNext,
    goBack,
    isFirstStep,
    isLastStep,
    isStepLoading,
    setStepLoading,
    canProceed,
    isDraftReady,
    clearDraft,
    returnStep,
  } = onboarding;
  const step = STEPS[currentStep];
  // After Editar on Resumen, Continuar goes straight back there.
  const nextStep = STEPS[returnStep ?? currentStep + 1];
  const stepTitle = typeof step.title === 'function' ? step.title(userName) : step.title;
  const StepComponent = step.Component;

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
        clearDraft();
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
          'relative z-10 flex max-h-full min-h-0 w-full max-w-[1000px] overflow-hidden motion-slide-up min-[781px]:h-[min(820px,100%)]',
        )}
      >
        <aside
          className="hidden w-[300px] shrink-0 flex-col gap-6 border-r border-white/[0.08] bg-primary/[0.05] p-8 min-[781px]:flex"
          aria-label="Primeros pasos"
        >
          <div className="flex items-center gap-2.5">
            <MicasaMark className="size-7" priority />
            <span className="text-section font-bold">MiCasa</span>
          </div>
          <OnboardingStepper
            stepNames={STEP_NAMES}
            currentStep={currentStep}
          />
          <div className="mt-auto empty:hidden">
            <OnboardingAsidePreviewSlot />
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="shrink-0 space-y-4 px-5 pt-5 pb-4 min-[781px]:px-9 min-[781px]:pt-8">
            <OnboardingProgressBar
              currentStep={currentStep}
              nextStepName={nextStep?.name}
              className="min-[781px]:hidden"
            />
            <div className="space-y-1.5">
              <h1 className="text-title text-foreground">{stepTitle}</h1>
              <p className="text-body text-muted-foreground">
                {step.description}
              </p>
            </div>
          </header>

          <div
            ref={bodyRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1 pb-6 min-[781px]:px-9"
          >
            {isDraftReady ? (
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
            ) : null}
          </div>

          {finishError ? (
            <div className="shrink-0 px-5 pb-3 min-[781px]:px-9">
              <ErrorBanner>{finishError}</ErrorBanner>
            </div>
          ) : null}

          <div className="shrink-0 border-t border-border/60 px-5 py-4 min-[781px]:px-9">
            <div className="mb-3 empty:hidden min-[781px]:hidden">
              <OnboardingPhoneStripSlot />
            </div>
            <footer className="flex items-center gap-3">
              {isFirstStep ? (
                <p className="text-caption text-muted-foreground">
                  Se guarda solo. Puedes cerrar y seguir después.
                </p>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBack}
                  disabled={isStepLoading}
                  className="h-11 rounded-xl px-3 text-primary-text"
                >
                  Atrás
                </Button>
              )}
              <div className="ml-auto flex items-center gap-2 min-[400px]:gap-3">
                <OnboardingSkipAction disabled={isStepLoading || !isDraftReady} />
                <Button
                  type="button"
                  onClick={handleNext}
                  className="h-11 min-w-24 shrink-0 rounded-xl px-3 min-[360px]:min-w-32 min-[360px]:px-4 min-[400px]:min-w-36"
                  disabled={isStepLoading || !canProceed || !isDraftReady}
                >
                  {primaryLabel}
                </Button>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

type OnboardingWizardProps = {
  /** Session user id; the saved draft is stored per user. */
  userId: string;
  /** Account name; Resumen says "Esto te queda libre, {nombre}". */
  userName?: string | null;
};

export default function OnboardingWizard({ userId, userName }: OnboardingWizardProps) {
  return (
    <OnboardingProvider userId={userId}>
      <OnboardingWizardContent userName={userName ?? ''} />
    </OnboardingProvider>
  );
}
