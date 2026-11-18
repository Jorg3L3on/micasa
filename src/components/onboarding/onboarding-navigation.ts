/**
 * Step moves for the onboarding wizard. Pure, so Resumen's "Editar" round trip
 * (jump to a step, Continuar comes back) is testable without React.
 */

/** Wizard step indexes (the stepper's "Cuenta creada" is not a wizard step). */
export const ONBOARDING_STEP = {
  wallets: 0,
  incomes: 1,
  expenses: 2,
  summary: 3,
} as const;

export type OnboardingNavState = {
  step: number;
  /** Set by Editar on Resumen: Continuar goes back here instead of one step on. */
  returnStep: number | null;
};

const clampStep = (step: number, totalSteps: number): number =>
  Math.min(Math.max(Math.trunc(step), 0), totalSteps - 1);

export const navNext = (state: OnboardingNavState, totalSteps: number): OnboardingNavState =>
  state.returnStep !== null && state.returnStep > state.step
    ? { step: clampStep(state.returnStep, totalSteps), returnStep: null }
    : { step: clampStep(state.step + 1, totalSteps), returnStep: null };

/** Atrás drops a pending return so the steps between are not skipped. */
export const navBack = (state: OnboardingNavState): OnboardingNavState => ({
  step: Math.max(state.step - 1, 0),
  returnStep: null,
});

export const navGoTo = (
  state: OnboardingNavState,
  target: number,
  totalSteps: number,
  options: { returnHere?: boolean } = {},
): OnboardingNavState => {
  const step = clampStep(target, totalSteps);
  return {
    step,
    returnStep: options.returnHere && step < state.step ? state.step : null,
  };
};
