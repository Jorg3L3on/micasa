/** @vitest-environment jsdom */

import type { ComponentProps } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditCardPaymentPlanDialog } from '@/components/planner/EditCardPaymentPlanDialog';
import CreditCardPaymentDialog from '@/components/credit-cards/CreditCardPaymentDialog';
import { CreditCardExternalPaymentDialog } from '@/components/credit-cards/CreditCardExternalPaymentDialog';
import { formatCurrency } from '@/lib/utils';

afterEach(() => {
  cleanup();
});

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: () => {},
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  });
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

const notice = (excess: number) =>
  `Es más que la deuda registrada (+${formatCurrency(excess)}). ¿Por qué?`;

const renderPlan = (
  props: Partial<ComponentProps<typeof EditCardPaymentPlanDialog>> = {},
) => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <EditCardPaymentPlanDialog
      open
      onOpenChange={vi.fn()}
      onSave={onSave}
      walletName="Tarjeta ejemplo"
      fortnightLabel="1ª quincena · octubre"
      knownPeriodAmount={400}
      outstandingBalance={1000}
      initialPlannedAmount={400}
      hasCustomPlan={false}
      {...props}
    />,
  );
  return { onSave };
};

const chooseReason = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) => {
  await user.click(screen.getByRole('combobox', { name: 'Motivo del cargo' }));
  await user.click(await screen.findByRole('option', { name: label }));
};

describe('plan dialog over the recorded debt', () => {
  it('shows the amber notice and keeps Guardar disabled until a reason is chosen', async () => {
    const user = userEvent.setup();
    const { onSave } = renderPlan({
      initialPlannedAmount: 1250,
      outstandingBalance: 1000,
    });

    expect(screen.getByText(notice(250))).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Guardar' });
    expect(save.hasAttribute('disabled')).toBe(true);

    await chooseReason(user, 'Intereses');

    expect(save.hasAttribute('disabled')).toBe(false);
    await user.click(save);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        plannedAmount: 1250,
        over_debt_reason: 'INTEREST',
      }),
    );
  });

  it('prefills the plan reason and sends it', async () => {
    const user = userEvent.setup();
    const { onSave } = renderPlan({
      initialPlannedAmount: 1400,
      outstandingBalance: 1000,
      initialOverDebtReason: 'LATE_FEE',
    });

    expect(screen.getByText(notice(400))).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Motivo del cargo' }).textContent).toContain(
      'Comisión por pago tardío',
    );
    const save = screen.getByRole('button', { name: 'Guardar' });
    expect(save.hasAttribute('disabled')).toBe(false);
    await user.click(save);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ over_debt_reason: 'LATE_FEE' }),
    );
  });

  it('warns only after the entered amount goes above the debt', async () => {
    const user = userEvent.setup();
    renderPlan({
      initialPlannedAmount: 400,
      outstandingBalance: 1000,
    });

    expect(screen.queryByText(/Es más que la deuda registrada/)).toBeNull();
    const amount = screen.getByRole('textbox', { name: 'Monto' });
    await user.clear(amount);
    await user.type(amount, '1200');

    expect(screen.getByText(notice(200))).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar' }).hasAttribute('disabled')).toBe(true);

    await user.clear(amount);
    await user.type(amount, '800');
    expect(screen.queryByText(/Es más que la deuda registrada/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Guardar' }).hasAttribute('disabled')).toBe(false);
  });

  it('leaves amounts at or below the debt without a notice or a reason', async () => {
    const user = userEvent.setup();
    const atDebt = renderPlan({
      initialPlannedAmount: 1000,
      outstandingBalance: 1000,
    });

    expect(screen.queryByText(/Es más que la deuda registrada/)).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Motivo del cargo' })).toBeNull();
    const save = screen.getByRole('button', { name: 'Guardar' });
    expect(save.hasAttribute('disabled')).toBe(false);
    await user.click(save);
    expect(atDebt.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ plannedAmount: 1000, over_debt_reason: null }),
    );
  });
});

describe('payment dialog over the recorded debt', () => {
  const funding = [
    {
      id: 7,
      name: 'Efectivo ejemplo',
      type: 'CASH',
      amount: 8000,
    },
  ];

  it('requires a reason and prefills the plan reason on the wallet payment', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <CreditCardPaymentDialog
        open
        onOpenChange={vi.fn()}
        fundingWalletOptions={funding}
        prefillAmount={1600}
        recordedDebt={1000}
        initialBankChargeReason="OTHER"
        submitting={false}
        error={null}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText(notice(600))).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Motivo del cargo' }).textContent).toContain(
      'IVA u otros',
    );

    await user.click(screen.getByRole('combobox', { name: 'Selecciona la billetera origen' }));
    await user.click(await screen.findByRole('option', { name: /Efectivo ejemplo/ }));

    const save = screen.getByRole('button', { name: 'Registrar pago' });
    expect(save.hasAttribute('disabled')).toBe(false);
    await user.click(save);

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1600,
        bank_charge: { reason: 'OTHER' },
      }),
    );
  });

  it('omits bank_charge when the payment is at or below the debt', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <CreditCardPaymentDialog
        open
        onOpenChange={vi.fn()}
        fundingWalletOptions={funding}
        prefillAmount={1000}
        recordedDebt={1000}
        submitting={false}
        error={null}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.queryByText(/Es más que la deuda registrada/)).toBeNull();
    await user.click(screen.getByRole('combobox', { name: 'Selecciona la billetera origen' }));
    await user.click(await screen.findByRole('option', { name: /Efectivo ejemplo/ }));
    await user.click(screen.getByRole('button', { name: 'Registrar pago' }));

    const payload = onConfirm.mock.calls[0]?.[0] as { bank_charge?: unknown };
    expect(payload.bank_charge).toBeUndefined();
    expect(payload).toMatchObject({ amount: 1000 });
  });

  it('asks the external payment for a reason only when the amount adjusts debt', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <CreditCardExternalPaymentDialog
        open
        onOpenChange={vi.fn()}
        prefillAmount={1800}
        recordedDebt={1000}
        initialBankChargeReason="INTEREST"
        submitting={false}
        error={null}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText(notice(800))).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Motivo del cargo' }).textContent).toContain(
      'Intereses',
    );
    await user.click(screen.getByRole('button', { name: 'Ya pagado' }));
    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1800,
        adjusts_debt: true,
        bank_charge: { reason: 'INTEREST' },
      }),
    );
  });
});
