import { describe, expect, it } from 'vitest';
import type { CreditCardInstallmentPlanItem } from '@/types/catalog';
import {
  CREATE_INSTALLMENT_PLAN_FORM_DEFAULTS,
  getInstallmentPlanFormValues,
} from '@/components/credit-cards/installment-plan-form-values';

const loadedPlan = (
  overrides: Partial<CreditCardInstallmentPlanItem> = {},
): CreditCardInstallmentPlanItem => ({
  id: 42,
  creditCardWalletId: 7,
  name: 'Generic appliance plan',
  installmentAmount: 499.5,
  totalInstallments: 12,
  paidInstallments: 3,
  currentInstallment: 4,
  remainingInstallments: 9,
  progressPct: 25,
  alreadyInCardBalance: true,
  status: 'ACTIVE',
  endMonthLabel: 'ago 2027',
  nextDueDate: '2026-09-15',
  payments: [],
  ...overrides,
});

describe('getInstallmentPlanFormValues', () => {
  it('returns create defaults when no plan is loaded', () => {
    const values = getInstallmentPlanFormValues(null, 15);
    expect(values.name).toBe(CREATE_INSTALLMENT_PLAN_FORM_DEFAULTS.name);
    expect(values.installmentAmount).toBe(
      CREATE_INSTALLMENT_PLAN_FORM_DEFAULTS.installmentAmount,
    );
    expect(values.totalInstallments).toBe(
      CREATE_INSTALLMENT_PLAN_FORM_DEFAULTS.totalInstallments,
    );
    expect(values.paidInstallments).toBe(
      CREATE_INSTALLMENT_PLAN_FORM_DEFAULTS.paidInstallments,
    );
    expect(values.alreadyInBalance).toBe(
      CREATE_INSTALLMENT_PLAN_FORM_DEFAULTS.alreadyInBalance,
    );
    expect(values.nextDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('opens edit on a loaded plan with that plan’s values, not create defaults', () => {
    const plan = loadedPlan({
      name: 'Furniture MSI',
      installmentAmount: 1250,
      totalInstallments: 18,
      paidInstallments: 5,
      alreadyInCardBalance: false,
      nextDueDate: '2026-10-20',
    });

    const editValues = getInstallmentPlanFormValues(plan, 15);
    const createValues = getInstallmentPlanFormValues(null, 15);

    expect(editValues.name).toBe('Furniture MSI');
    expect(editValues.installmentAmount).toBe(1250);
    expect(editValues.totalInstallments).toBe('18');
    expect(editValues.paidInstallments).toBe('5');
    expect(editValues.nextDueDate).toBe('2026-10-20');
    expect(editValues.alreadyInBalance).toBe(false);

    expect(editValues.name).not.toBe(createValues.name);
    expect(editValues.installmentAmount).not.toBe(createValues.installmentAmount);
    expect(editValues.totalInstallments).not.toBe(createValues.totalInstallments);
    expect(editValues.paidInstallments).not.toBe(createValues.paidInstallments);
    expect(editValues).not.toEqual(createValues);
  });

  it('falls back to card due-day for next due when plan has none', () => {
    const plan = loadedPlan({ nextDueDate: null });
    const values = getInstallmentPlanFormValues(plan, 15);
    expect(values.nextDueDate).toMatch(/^\d{4}-\d{2}-15$/);
    expect(values.name).toBe(plan.name);
    expect(values.installmentAmount).toBe(plan.installmentAmount);
  });
});
