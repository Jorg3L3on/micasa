/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreditCardDuePaymentStrip } from '@/components/credit-cards/CreditCardDetailSections';
import type { CreditCardStatementResponse } from '@/types/catalog';

const statement = (
  overrides: Partial<CreditCardStatementResponse> = {},
): CreditCardStatementResponse =>
  ({
    next_due_payment: 1500,
    statement_due_date: '2026-11-20',
    declared_zero: false,
    period_obligation: null,
    ...overrides,
  }) as CreditCardStatementResponse;

const pagar = () => screen.queryByRole('button', { name: 'Pagar' });

afterEach(cleanup);

describe('CreditCardDuePaymentStrip', () => {
  it('offers Pagar when a payment is pending', async () => {
    const onPay = vi.fn();
    render(
      <CreditCardDuePaymentStrip
        statement={statement()}
        daysUntilDue={5}
        onPay={onPay}
      />,
    );

    await userEvent.click(pagar()!);

    expect(onPay).toHaveBeenCalledOnce();
  });

  it('offers Pagar on an overdue payment', () => {
    render(
      <CreditCardDuePaymentStrip
        statement={statement()}
        daysUntilDue={-3}
        onPay={() => {}}
      />,
    );

    expect(pagar()).not.toBeNull();
  });

  it('hides Pagar without a handler, as on past cycles', () => {
    render(<CreditCardDuePaymentStrip statement={statement()} daysUntilDue={5} />);

    expect(pagar()).toBeNull();
  });

  it('hides Pagar when nothing is pending', () => {
    render(
      <CreditCardDuePaymentStrip
        statement={statement({ next_due_payment: 0 })}
        daysUntilDue={5}
        onPay={() => {}}
      />,
    );

    expect(pagar()).toBeNull();
  });

  it('hides Pagar on a declared $0 cycle', () => {
    render(
      <CreditCardDuePaymentStrip
        statement={statement({ declared_zero: true })}
        daysUntilDue={5}
        onPay={() => {}}
      />,
    );

    expect(pagar()).toBeNull();
  });
});
