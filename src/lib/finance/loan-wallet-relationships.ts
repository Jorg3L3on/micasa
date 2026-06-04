import type { LoanListItem } from '@/types/loans';

type LoanWalletRelationshipInput = Pick<
  LoanListItem,
  | 'sourceWalletId'
  | 'sourceWalletName'
  | 'linkedWalletId'
  | 'linkedWalletName'
  | 'paymentSource'
  | 'incomeTemplateName'
>;

export type LoanWalletRelationship = {
  role: 'payment_source' | 'reference_account';
  label: string;
  description: string;
};

export function getLoanPaymentSourceLabel(
  loan: Pick<
    LoanListItem,
    'paymentSource' | 'sourceWalletName' | 'incomeTemplateName'
  >,
): string {
  if (loan.paymentSource === 'PAYROLL_DEDUCTION') {
    return `Deducción de nómina${
      loan.incomeTemplateName ? `: ${loan.incomeTemplateName}` : ''
    }`;
  }

  return `Origen de pago${
    loan.sourceWalletName ? `: ${loan.sourceWalletName}` : ''
  }`;
}

export function getLoanWalletRelationships(
  loan: LoanWalletRelationshipInput,
  walletId: number,
): LoanWalletRelationship[] {
  const relationships: LoanWalletRelationship[] = [];

  if (loan.sourceWalletId === walletId) {
    relationships.push({
      role: 'payment_source',
      label: 'Origen de pago',
      description: 'Se proyecta como salida futura desde esta billetera.',
    });
  }

  if (loan.linkedWalletId === walletId) {
    relationships.push({
      role: 'reference_account',
      label: 'Cuenta relacionada',
      description:
        'Solo referencia para seguimiento; no ajusta el saldo automáticamente.',
    });
  }

  return relationships;
}
