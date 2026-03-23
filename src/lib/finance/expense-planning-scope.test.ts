import { describe, expect, it } from 'vitest';
import {
  isCreditMsiInstallmentExpense,
  parseMsiFromDescription,
  wherePlanningCashFlowExpenses,
} from '@/lib/finance/expense-planning-scope';

describe('parseMsiFromDescription', () => {
  it('parses last «N de M» token in description', () => {
    expect(
      parseMsiFromDescription('Compra en MERCADO PAGO 1 11 de 15'),
    ).toEqual({ current: 11, total: 15 });
  });

  it('returns null when pattern missing', () => {
    expect(parseMsiFromDescription('Compra en SORIANA')).toBeNull();
  });

  it('rejects invalid ranges', () => {
    expect(parseMsiFromDescription('foo 16 de 15')).toBeNull();
  });
});

describe('isCreditMsiInstallmentExpense', () => {
  it('is true when both MSI fields valid', () => {
    expect(
      isCreditMsiInstallmentExpense({
        credit_msi_current: 3,
        credit_msi_total: 9,
      }),
    ).toBe(true);
  });

  it('is false when either null', () => {
    expect(
      isCreditMsiInstallmentExpense({
        credit_msi_current: 3,
        credit_msi_total: null,
      }),
    ).toBe(false);
  });

  it('is false when current exceeds total', () => {
    expect(
      isCreditMsiInstallmentExpense({
        credit_msi_current: 10,
        credit_msi_total: 3,
      }),
    ).toBe(false);
  });
});

describe('wherePlanningCashFlowExpenses', () => {
  it('combines MSI and non–credit-wallet filters', () => {
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
