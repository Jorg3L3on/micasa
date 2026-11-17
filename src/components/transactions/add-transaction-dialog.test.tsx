/** @vitest-environment jsdom */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddTransactionDialog from '@/components/transactions/AddTransactionDialog';

const fetchCatalog = vi.fn();
const getWallets = vi.fn();

const financeContext = vi.hoisted(() => ({
  context: { type: 'user', id: 1 },
}));

vi.mock('@/context/finance-context', () => ({
  useFinanceContext: () => financeContext,
}));
vi.mock('@/lib/api/client-fetch', () => ({
  clientFetchFromApi: (...args: unknown[]) => fetchCatalog(...args),
}));
vi.mock('@/lib/api/wallets', () => ({
  getPaymentMethodOptions: (...args: unknown[]) => getWallets(...args),
}));

const card = {
  id: 7,
  name: 'Oro',
  type: 'CREDIT_CARD',
  amount: 900,
  credit_limit: 1000,
};
const debit = { id: 8, name: 'Nómina', type: 'DEBIT_CARD', amount: 5000 };
const category = { id: 3, name: 'Comida', kind: 'expense', parent_id: null };

const noop = async () => {};

const setup = (props: Partial<Parameters<typeof AddTransactionDialog>[0]> = {}) =>
  render(
    <AddTransactionDialog
      open
      onOpenChange={() => {}}
      onSaveExpense={noop}
      onSaveIncome={noop}
      {...props}
    />,
  );

const save = () => screen.findByRole('button', { name: 'Guardar' });

beforeAll(() => {
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', Observer);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }),
  });
});

beforeEach(() => {
  fetchCatalog.mockReset().mockResolvedValue([category]);
  getWallets.mockReset().mockResolvedValue([debit, card]);
});

afterEach(cleanup);

describe('AddTransactionDialog', () => {
  it('explains a failed catalog load and retries it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    getWallets.mockRejectedValueOnce(new Error('down'));
    setup();

    expect(
      await screen.findByText('No se pudieron cargar las categorías y billeteras.'),
    ).toBeTruthy();
    expect((await save()).hasAttribute('disabled')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() =>
      expect(
        screen.queryByText('No se pudieron cargar las categorías y billeteras.'),
      ).toBeNull(),
    );
    await waitFor(async () =>
      expect((await save()).hasAttribute('disabled')).toBe(false),
    );
  });

  it('says why a purchase over the credit limit cannot be saved', async () => {
    setup({ expenseDefaults: { paymentMethodId: 7, amount: 250 } });

    expect(
      await screen.findByText(/supera el crédito disponible de Oro por \$150\.00/),
    ).toBeTruthy();
    expect((await save()).hasAttribute('disabled')).toBe(true);
  });

  it('saves with Enter from the name field', async () => {
    const onSaveExpense = vi.fn().mockResolvedValue(undefined);
    setup({
      onSaveExpense,
      expenseDefaults: { paymentMethodId: 8, amount: 100, categoryId: 3 },
    });
    await save();

    await userEvent.type(
      screen.getByPlaceholderText('Ej. café, súper'),
      'Café{Enter}',
    );

    await waitFor(() => expect(onSaveExpense).toHaveBeenCalledOnce());
  });

  it('keeps a failed save inside the dialog', async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => rejections.push(reason);
    process.on('unhandledRejection', onRejection);
    const onSaveExpense = vi.fn().mockRejectedValue(new Error('no'));
    setup({
      onSaveExpense,
      expenseDefaults: { paymentMethodId: 8, amount: 100, categoryId: 3, name: 'Café' },
    });

    await userEvent.click(await save());
    await waitFor(() => expect(onSaveExpense).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 0));
    process.off('unhandledRejection', onRejection);

    expect(rejections).toEqual([]);
    expect((await save()).hasAttribute('disabled')).toBe(false);
  });

  it('switches type with the keyboard', async () => {
    setup();
    const bar = await screen.findByRole('tablist', { name: 'Tipo de movimiento' });

    bar.focus();
    await userEvent.keyboard('{End}');
    expect(
      screen.getByRole('tab', { name: 'Ingreso' }).getAttribute('aria-selected'),
    ).toBe('true');

    await userEvent.keyboard('{Home}');
    expect(
      screen.getByRole('tab', { name: 'Gasto' }).getAttribute('aria-selected'),
    ).toBe('true');
  });
});
