import { describe, expect, it } from 'vitest';
import {
  getCategoryIconOption,
  isCategoryIconKey,
  isLegacyCategoryIcon,
  resolveOnboardingCategoryIcon,
  validateCategoryIconInput,
} from '@/lib/category-icons';

describe('category-icons registry', () => {
  it('resolves known Lucide keys', () => {
    expect(getCategoryIconOption('UTENSILS')?.label).toBe('Comida');
    expect(isCategoryIconKey('CAR')).toBe(true);
  });

  it('treats empty and unknown values as non-keys', () => {
    expect(getCategoryIconOption(null)).toBeNull();
    expect(getCategoryIconOption('NOT_A_KEY')).toBeNull();
    expect(isLegacyCategoryIcon('🍽️')).toBe(true);
    expect(isLegacyCategoryIcon('UTENSILS')).toBe(false);
  });

  it('maps default onboarding category names', () => {
    expect(resolveOnboardingCategoryIcon('Comida')).toBe('UTENSILS');
    expect(resolveOnboardingCategoryIcon('Transporte')).toBe('CAR');
    expect(resolveOnboardingCategoryIcon('Vivienda')).toBe('HOME');
    expect(resolveOnboardingCategoryIcon('Otro')).toBeNull();
  });
});

describe('validateCategoryIconInput', () => {
  it('accepts known keys and empty values', () => {
    expect(validateCategoryIconInput('UTENSILS', null)).toEqual({
      ok: true,
      value: 'UTENSILS',
    });
    expect(validateCategoryIconInput('', null)).toEqual({ ok: true, value: null });
    expect(validateCategoryIconInput(undefined, '🍽️')).toEqual({
      ok: true,
      value: '🍽️',
    });
  });

  it('rejects invalid new values', () => {
    expect(validateCategoryIconInput('invalid-key', null)).toEqual({
      ok: false,
      message: 'Selecciona un ícono de la lista o deja el campo vacío',
    });
  });

  it('preserves unchanged legacy icons on update', () => {
    expect(validateCategoryIconInput('🍽️', '🍽️')).toEqual({
      ok: true,
      value: '🍽️',
    });
    expect(validateCategoryIconInput('CAR', '🍽️')).toEqual({
      ok: true,
      value: 'CAR',
    });
  });
});
