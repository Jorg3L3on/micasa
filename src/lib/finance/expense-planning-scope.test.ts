import { describe, expect, it } from 'vitest';
import {
  isCreditInstallmentExpense,
  parseInstallmentFromDescription,
  wherePlanningCashFlowExpenses,
} from '@/lib/finance/expense-planning-scope';

describe('parseInstallmentFromDescription', () => {
  it('parses last «N de M» token in description', () => {
    expect(
      parseInstallmentFromDescription('Compra en MERCADO PAGO 1 11 de 15'),
    ).toEqual({ current: 11, total: 15 });
  });

  it('returns null when pattern missing', () => {
    expect(parseInstallmentFromDescription('Compra en SORIANA')).toBeNull();
  });

  it('rejects invalid ranges', () => {
    expect(parseInstallmentFromDescription('foo 16 de 15')).toBeNull();
  });
});

describe('isCreditInstallmentExpense', () => {
  it('is true when both installment fields valid', () => {
    expect(
      isCreditInstallmentExpense({
        credit_installment_current: 3,
        credit_installment_total: 9,
      }),
    ).toBe(true);
  });

  it('is false when either null', () => {
    expect(
      isCreditInstallmentExpense({
        credit_installment_current: 3,
        credit_installment_total: null,
      }),
    ).toBe(false);
  });

  it('is false when current exceeds total', () => {
    expect(
      isCreditInstallmentExpense({
        credit_installment_current: 10,
        credit_installment_total: 3,
      }),
    ).toBe(false);
  });
});

describe('wherePlanningCashFlowExpenses', () => {
  it('combines installment and non–credit-wallet filters', () => {
    const w = wherePlanningCashFlowExpenses();
    expect(w).toEqual(
      expect.objectContaining({
        AND: expect.arrayContaining([
          expect.objectContaining({ OR: expect.any(Array) }),
        ]),
      }),
    );
    expect((w as { AND: unknown[] }).AND).toHaveLength(2);
  });
});
