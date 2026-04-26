'use client';

import { useRouter } from 'next/navigation';
import { OnboardingProvider, useOnboarding } from '@/components/onboarding/OnboardingContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import StepWelcome from '@/components/onboarding/steps/StepWelcome';
import StepWallets from '@/components/onboarding/steps/StepWallets';
import StepCategories from '@/components/onboarding/steps/StepCategories';
import StepIncomeTemplates from '@/components/onboarding/steps/StepIncomeTemplates';
import StepExpenseTemplates from '@/components/onboarding/steps/StepExpenseTemplates';
import StepFortnights from '@/components/onboarding/steps/StepFortnights';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  CategoryDraft,
  ExpenseTemplateDraft,
  IncomeTemplateDraft,
  WalletDraft,
} from '@/components/onboarding/OnboardingContext';

const steps = [
  StepWelcome,
  StepWallets,
  StepCategories,
  StepIncomeTemplates,
  StepExpenseTemplates,
  StepFortnights,
] as const;

const stepTitles: Record<number, string> = {
  0: 'Bienvenido a MiCasa',
  1: 'Billeteras',
  2: 'Categorías',
  3: 'Plantillas de ingresos',
  4: 'Plantillas de gastos',
  5: 'Quincenas',
};

const stepDescriptions: Record<number, string> = {
  0: 'Configura tu cuenta en menos de un minuto.',
  1: '',
  2: '',
  3: '',
  4: '',
  5: '',
};

const stepContentVariants = {
  enter: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

const stepContentTransition = { duration: 0.25 };

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

  const handleFinish = async () => {
    try {
      setStepLoading(true);

      const startDate =
        typeof onboarding.startDate === 'string'
          ? onboarding.startDate
          : null;

      const onboardingPayload: {
        wallets: WalletDraft[];
        categories: CategoryDraft[];
        incomeTemplates: IncomeTemplateDraft[];
        expenseTemplates: ExpenseTemplateDraft[];
        startDate: string | null;
      } = {
        wallets: onboarding.wallets ?? [],
        categories: onboarding.categories ?? [],
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
        router.push('/dashboard');
        return;
      }

      try {
        const errorBody = await response.json();
        console.error('Onboarding completion failed:', response.status, errorBody);
      } catch {
        console.error('Onboarding completion failed with non-JSON response:', response.status);
      }
    } catch (error) {
      console.error('Onboarding completion error', error);
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-6">
      <motion.div
        className="w-full max-w-[640px]"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="w-full border-0 shadow-lg">
          <CardHeader className="space-y-8 pb-2">
            {/* Stepper dots */}
            <div
              className="flex items-center justify-center gap-2"
              role="list"
              aria-label={`Paso ${currentStep + 1} de ${totalSteps}`}
            >
              {Array.from({ length: totalSteps }, (_, i) => {
                const isCompleted = i < currentStep;
                const isActive = i === currentStep;

                return (
                  <motion.span
                    key={i}
                    role="listitem"
                    className={`rounded-full ${
                      isCompleted
                        ? 'bg-primary h-2 w-2'
                        : isActive
                          ? 'bg-primary h-3 w-3'
                          : 'bg-muted-foreground/30 h-2 w-2'
                    }`}
                    aria-current={isActive ? 'step' : undefined}
                    initial={{ scale: 0.9, opacity: 0.7 }}
                    animate={{
                      scale: isActive ? 1 : 0.9,
                      opacity: isCompleted || isActive ? 1 : 0.6,
                    }}
                    transition={{ duration: 0.2 }}
                  />
                );
              })}
            </div>

            {/* Progress bar + label */}
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                Paso {currentStep + 1} de {totalSteps}
              </p>
              <div
                className="bg-muted h-2 w-full overflow-hidden rounded-full"
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Paso ${currentStep + 1} de ${totalSteps}`}
              >
                <motion.div
                  className="bg-primary h-full rounded-full"
                  initial={false}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Step title & description */}
            <div className="space-y-1">
              <CardTitle className="text-xl">{title}</CardTitle>
              {description ? (
                <CardDescription>{description}</CardDescription>
              ) : null}
            </div>
          </CardHeader>

          <CardContent className="min-h-[120px] pt-6">
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
          </CardContent>

          <CardFooter className="flex w-full gap-3 border-t pt-6">
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
                ? 'Preparando tu espacio financiero...'
                : isLastStep
                  ? 'Finalizar'
                  : 'Continuar'}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
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
