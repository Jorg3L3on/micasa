'use client';

import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/components/onboarding/OnboardingContext';
import { ONBOARDING_STEP } from '@/components/onboarding/onboarding-navigation';

/**
 * "Omitir por ahora" next to Continuar on Gastos fijos: drops the drafted fixed
 * costs and moves on, even while a row is incomplete. Renders nothing on other steps.
 */
export function OnboardingSkipAction({ disabled }: { disabled?: boolean }) {
  const { currentStep, setExpenseTemplates, goNext } = useOnboarding();
  if (currentStep !== ONBOARDING_STEP.expenses) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      onClick={() => {
        setExpenseTemplates([]);
        goNext();
      }}
      className="h-11 rounded-xl px-2.5 font-medium text-muted-foreground hover:text-foreground min-[400px]:px-3"
    >
      <span>
        Omitir<span className="hidden min-[400px]:inline"> por ahora</span>
      </span>
    </Button>
  );
}
