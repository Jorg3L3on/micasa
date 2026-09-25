import { describe, expect, it } from 'vitest';
import { pickPaymentCategoryId } from '@/lib/finance/payment-category';

describe('pickPaymentCategoryId', () => {
  it('uses the household credit-card category before the catalog name', () => {
    expect(
      pickPaymentCategoryId(
        [
          { id: 1, name: 'Tarjeta de crédito' },
          { id: 33, name: 'Tarjetas de crédito' },
        ],
        'CREDIT_CARD',
      ),
    ).toBe(33);
  });

  it('uses the catalog department-store category when that is the only one', () => {
    expect(
      pickPaymentCategoryId(
        [{ id: 180, name: 'Tarjeta departamental' }],
        'DEPARTMENT_STORE_CARD',
      ),
    ).toBe(180);
  });

  it('prefers Préstamos over the generated payment category', () => {
    expect(
      pickPaymentCategoryId(
        [
          { id: 43, name: 'Pago de préstamos' },
          { id: 42, name: 'Préstamos' },
        ],
        'LOAN',
      ),
    ).toBe(42);
  });
});
