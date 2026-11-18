import { describe, expect, it } from 'vitest';
import {
  ONBOARDING_STEP,
  navBack,
  navGoTo,
  navNext,
} from './onboarding-navigation';

const TOTAL = 4;

describe('onboarding navigation', () => {
  it('moves one step at a time and stops at the ends', () => {
    expect(navNext({ step: 0, returnStep: null }, TOTAL)).toEqual({ step: 1, returnStep: null });
    expect(navNext({ step: 3, returnStep: null }, TOTAL)).toEqual({ step: 3, returnStep: null });
    expect(navBack({ step: 0, returnStep: null })).toEqual({ step: 0, returnStep: null });
  });

  it('Editar on Resumen jumps to the step and Continuar comes back to Resumen', () => {
    const summary = { step: ONBOARDING_STEP.summary, returnStep: null };
    for (const target of [
      ONBOARDING_STEP.wallets,
      ONBOARDING_STEP.incomes,
      ONBOARDING_STEP.expenses,
    ]) {
      const editing = navGoTo(summary, target, TOTAL, { returnHere: true });
      expect(editing).toEqual({ step: target, returnStep: ONBOARDING_STEP.summary });
      expect(navNext(editing, TOTAL)).toEqual({
        step: ONBOARDING_STEP.summary,
        returnStep: null,
      });
    }
  });

  it('Atrás while editing drops the return so no step is skipped', () => {
    const editing = navGoTo(
      { step: ONBOARDING_STEP.summary, returnStep: null },
      ONBOARDING_STEP.incomes,
      TOTAL,
      { returnHere: true },
    );
    const back = navBack(editing);
    expect(back).toEqual({ step: ONBOARDING_STEP.wallets, returnStep: null });
    expect(navNext(back, TOTAL).step).toBe(ONBOARDING_STEP.incomes);
  });

  it('a plain jump or a jump forward never sets a return', () => {
    expect(navGoTo({ step: 3, returnStep: null }, 1, TOTAL)).toEqual({ step: 1, returnStep: null });
    expect(navGoTo({ step: 1, returnStep: null }, 3, TOTAL, { returnHere: true })).toEqual({
      step: 3,
      returnStep: null,
    });
    expect(navGoTo({ step: 1, returnStep: null }, 9, TOTAL).step).toBe(3);
    expect(navGoTo({ step: 1, returnStep: null }, -2, TOTAL).step).toBe(0);
  });
});
