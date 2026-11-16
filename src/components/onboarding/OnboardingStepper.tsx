import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** "Cuenta creada" is shown as step 1 and is always done. */
export const ONBOARDING_DISPLAY_TOTAL_STEPS = 5;

export type StepperState = 'done' | 'current' | 'upcoming';

/** Display number (1–5) for an internal wizard step (0–3). */
export const displayStepNumber = (internalStep: number): number =>
  internalStep + 2;

export const stepperState = (
  internalIndex: number,
  currentStep: number,
): StepperState => {
  if (internalIndex < currentStep) return 'done';
  if (internalIndex === currentStep) return 'current';
  return 'upcoming';
};

type StepDotProps = {
  state: StepperState;
  number: number;
};

const StepDot = ({ state, number }: StepDotProps) => (
  <span
    className={cn(
      'flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-semibold tabular-nums',
      state === 'done' &&
        'border-emerald-500/45 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      state === 'current' &&
        'border-primary bg-primary text-primary-foreground shadow-[0_0_12px_-1px_rgb(58_55_252_/_0.8)]',
      state === 'upcoming' && 'border-foreground/25 text-muted-foreground dark:border-white/[0.16]',
    )}
    aria-hidden="true"
  >
    {state === 'done' ? <Check className="size-3.5" strokeWidth={2.5} /> : number}
  </span>
);

const STATE_LABEL: Record<StepperState, string> = {
  done: 'hecho',
  current: 'paso actual',
  upcoming: 'pendiente',
};

type OnboardingStepperProps = {
  /** Names of the four wizard steps, in order. */
  stepNames: string[];
  currentStep: number;
  className?: string;
};

/** Desktop aside: Cuenta creada plus the four wizard steps. */
export const OnboardingStepper = ({
  stepNames,
  currentStep,
  className,
}: OnboardingStepperProps) => {
  const items: { name: string; state: StepperState }[] = [
    { name: 'Cuenta creada', state: 'done' },
    ...stepNames.map((name, index) => ({
      name,
      state: stepperState(index, currentStep),
    })),
  ];

  return (
    <ol className={cn('flex flex-col gap-0.5', className)} aria-label="Pasos">
      {items.map((item, index) => (
        <li
          key={item.name}
          className={cn(
            'flex min-h-10 items-center gap-3 text-body',
            item.state === 'current'
              ? 'font-semibold text-foreground'
              : 'text-muted-foreground',
          )}
          aria-current={item.state === 'current' ? 'step' : undefined}
        >
          <StepDot state={item.state} number={index + 1} />
          <span>
            {item.name}
            <span className="sr-only">, {STATE_LABEL[item.state]}</span>
          </span>
        </li>
      ))}
    </ol>
  );
};

type OnboardingProgressBarProps = {
  currentStep: number;
  nextStepName?: string;
  className?: string;
};

/** Phones: five segments and "Paso N de 5 · Sigue: …". */
export const OnboardingProgressBar = ({
  currentStep,
  nextStepName,
  className,
}: OnboardingProgressBarProps) => {
  const displayStep = displayStepNumber(currentStep);
  const label = `Paso ${displayStep} de ${ONBOARDING_DISPLAY_TOTAL_STEPS}`;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        className="flex gap-1"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={ONBOARDING_DISPLAY_TOTAL_STEPS}
        aria-valuenow={displayStep}
        aria-label={label}
      >
        {Array.from({ length: ONBOARDING_DISPLAY_TOTAL_STEPS }, (_, index) => (
          <div
            key={index}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-(--motion-base) motion-reduce:transition-none',
              index < displayStep
                ? 'bg-linear-to-r from-primary to-[#911efe] shadow-[0_0_10px_-1px_rgb(58_55_252_/_0.8)]'
                : 'bg-foreground/10 dark:bg-white/[0.12]',
            )}
          />
        ))}
      </div>
      <p className="text-caption text-muted-foreground">
        {label}
        {nextStepName ? ` · Sigue: ${nextStepName}` : null}
      </p>
    </div>
  );
};
