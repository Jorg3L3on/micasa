/** @vitest-environment jsdom */

import type { ComponentProps } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import FortnightCardPaymentsPanel from '@/components/planner/FortnightCardPaymentsPanel';
import FortnightLoanPaymentsPanel from '@/components/planner/FortnightLoanPaymentsPanel';
import type { DuePaymentItem } from '@/types/catalog';
import type { LoanDuePaymentItem } from '@/types/loans';

vi.mock('@/context/finance-context', () => ({
  useFinanceContext: () => ({ context: { type: 'user', id: 1 } }),
}));

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

afterEach(() => {
  cleanup();
});

const card = (
  overrides: Partial<DuePaymentItem> & Pick<DuePaymentItem, 'walletId' | 'walletName'>,
): DuePaymentItem => ({
  walletType: 'DEPARTMENT_STORE_CARD',
  providerIconKey: null,
  dueDay: 20,
  cutoff_day: 5,
  nextDuePayment: 1200,
  paymentsAppliedToStatement: 0,
  statementDueDate: '2030-08-20',
  outstandingBalance: 3400,
  effectiveAmount: 1200,
  remainingPlannerAmount: 1200,
  plannerStatus: 'por_pagar',
  statementPayoff: 1200,
  ...overrides,
});

const loan = (
  overrides: Partial<LoanDuePaymentItem> &
    Pick<LoanDuePaymentItem, 'id' | 'loanName' | 'lender'>,
): LoanDuePaymentItem => ({
  loanId: overrides.id,
  sequence: 1,
  dueDate: '2030-08-18',
  amount: 900,
  status: 'SCHEDULED',
  paidAt: null,
  sourceWalletId: null,
  sourceWalletName: null,
  linkedExpenseId: null,
  lenderPaymentId: null,
  note: null,
  lenderId: overrides.id,
  lenderProviderIconKey: null,
  loanType: 'PERSONAL',
  paymentSource: 'WALLET',
  linkedWalletId: null,
  linkedWalletName: null,
  incomeTemplateName: null,
  ...overrides,
});

const renderCards = (
  items: DuePaymentItem[],
  props: Partial<ComponentProps<typeof FortnightCardPaymentsPanel>> = {},
) =>
  render(
    <FortnightCardPaymentsPanel
      items={items}
      ownerQueryString=""
      fortnightLabel="2ª quincena"
      fortnightId={7}
      plannerYear={2030}
      plannerMonth={8}
      plannerPeriod="SECOND"
      variant="list"
      {...props}
    />,
  );

const rowFor = (container: HTMLElement, name: string) => {
  const row = [...container.querySelectorAll('li')].find((li) =>
    li.textContent?.includes(name),
  );
  if (!row) throw new Error(`No row for ${name}`);
  return row;
};

describe('Tarjetas rows: provider identity', () => {
  it('shows the provider logo when the wallet has one, and the generic icon otherwise', () => {
    const { container } = renderCards([
      card({ walletId: 1, walletName: 'Tienda Carmen', providerIconKey: 'LIVERPOOL' }),
      card({ walletId: 2, walletName: 'Tarjeta sin logo' }),
      card({ walletId: 3, walletName: 'Banco genérico', providerIconKey: 'GENERIC_BANK' }),
    ]);

    const withLogo = rowFor(container, 'Tienda Carmen');
    expect(withLogo.querySelector('[data-provider-key="LIVERPOOL"] img')).not.toBeNull();
    expect(withLogo.querySelector('svg.lucide-store')).toBeNull();

    for (const name of ['Tarjeta sin logo', 'Banco genérico']) {
      const row = rowFor(container, name);
      expect(row.querySelector('[data-provider-key]')).toBeNull();
      expect(row.querySelector('svg.lucide-store')).not.toBeNull();
    }
  });
});

describe('Préstamos rows: provider identity', () => {
  it('shows the lender logo when the lender has one, and the generic icons otherwise', () => {
    const { container } = render(
      <FortnightLoanPaymentsPanel
        fortnightLabel="2ª quincena"
        variant="list"
        items={[
          loan({
            id: 1,
            loanName: 'Préstamo auto',
            lender: 'Banco Uno',
            lenderProviderIconKey: 'BBVA',
          }),
          loan({ id: 2, loanName: 'Préstamo familiar', lender: 'Tía Rosa' }),
          loan({
            id: 3,
            loanName: 'Crédito nómina',
            lender: 'Patronal',
            loanType: 'PAYROLL',
            paymentSource: 'PAYROLL_DEDUCTION',
          }),
        ]}
      />,
    );

    const withLogo = rowFor(container, 'Banco Uno');
    expect(withLogo.querySelector('[data-provider-key="BBVA"] img')).not.toBeNull();

    const generic = rowFor(container, 'Tía Rosa');
    expect(generic.querySelector('[data-provider-key]')).toBeNull();
    expect(generic.querySelector('svg.lucide-hand-coins')).not.toBeNull();

    const payroll = rowFor(container, 'Patronal');
    expect(payroll.querySelector('[data-provider-key]')).toBeNull();
    expect(payroll.querySelector('svg.lucide-landmark')).not.toBeNull();
  });
});
