import { describe, expect, it } from 'vitest';
import { formatCurrency } from '@/lib/utils';
import {
  BANK_CHARGE_REQUIRED_MESSAGE,
  OVER_DEBT_REASON_REQUIRED_MESSAGE,
  cardChargeErrorMessage,
  cardDebtExcess,
  overDebtNoticeMessage,
} from '@/components/credit-cards/over-debt-reason';

describe('card debt excess', () => {
  it('is zero at and below the recorded debt', () => {
    expect(cardDebtExcess(1000, 1000)).toBe(0);
    expect(cardDebtExcess(999.99, 1000)).toBe(0);
    expect(cardDebtExcess(null, 1000)).toBe(0);
  });

  it('rounds the amount above the debt to cents', () => {
    expect(cardDebtExcess(1000.1, 1000)).toBe(0.1);
    expect(cardDebtExcess(1250.555, 1000)).toBe(250.56);
  });
});

describe('over-debt copy', () => {
  it('names the excess in the amber notice', () => {
    expect(overDebtNoticeMessage(150)).toBe(
      `Es más que la deuda registrada (+${formatCurrency(150)}). ¿Por qué?`,
    );
  });

  it('maps the two server codes to Spanish and leaves other errors alone', () => {
    const overDebt = Object.assign(new Error('raw'), {
      code: 'OVER_DEBT_REASON_REQUIRED',
    });
    const bankCharge = Object.assign(new Error('raw'), {
      code: 'BANK_CHARGE_REQUIRED',
    });
    expect(cardChargeErrorMessage(overDebt, 'fallback')).toBe(
      OVER_DEBT_REASON_REQUIRED_MESSAGE,
    );
    expect(cardChargeErrorMessage(bankCharge, 'fallback')).toBe(
      BANK_CHARGE_REQUIRED_MESSAGE,
    );
    expect(cardChargeErrorMessage(new Error('Saldo insuficiente'), 'fallback')).toBe(
      'Saldo insuficiente',
    );
    expect(cardChargeErrorMessage('nope', 'No se pudo guardar')).toBe(
      'No se pudo guardar',
    );
  });
});
