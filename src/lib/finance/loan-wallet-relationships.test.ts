import { describe, expect, it } from 'vitest';
import {
  getLoanPaymentSourceLabel,
  getLoanWalletRelationships,
} from '@/lib/finance/loan-wallet-relationships';

describe('loan wallet relationship copy', () => {
  it('distinguishes wallet payment sources from reference accounts', () => {
    const relationships = getLoanWalletRelationships(
      {
        paymentSource: 'WALLET',
        sourceWalletId: 10,
        sourceWalletName: 'BBVA',
        linkedWalletId: 20,
        linkedWalletName: 'Tarjeta referencia',
        incomeTemplateName: null,
      },
      10,
    );

    expect(relationships).toEqual([
      {
        role: 'payment_source',
        label: 'Origen de pago',
        description: 'Se proyecta como salida futura desde esta billetera.',
      },
    ]);
  });

  it('explains linked accounts as relationship-only references', () => {
    const relationships = getLoanWalletRelationships(
      {
        paymentSource: 'PAYROLL_DEDUCTION',
        sourceWalletId: null,
        sourceWalletName: null,
        linkedWalletId: 20,
        linkedWalletName: 'Tarjeta referencia',
        incomeTemplateName: 'Nómina Jorge',
      },
      20,
    );

    expect(relationships).toEqual([
      {
        role: 'reference_account',
        label: 'Cuenta relacionada',
        description:
          'Solo referencia para seguimiento; no ajusta el saldo automáticamente.',
      },
    ]);
  });

  it('labels payroll deductions without implying a wallet outflow', () => {
    expect(
      getLoanPaymentSourceLabel({
        paymentSource: 'PAYROLL_DEDUCTION',
        sourceWalletName: null,
        incomeTemplateName: 'Nómina Jorge',
      }),
    ).toBe('Deducción de nómina: Nómina Jorge');
  });
});
