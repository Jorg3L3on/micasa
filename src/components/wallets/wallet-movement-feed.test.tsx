/** @vitest-environment jsdom */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletMovementsFeed } from '@/components/wallets/WalletMovementFeed';
import type { WalletMovement } from '@/types/wallet-movements';

const movement = (overrides: Partial<WalletMovement>): WalletMovement => ({
  id: 1,
  kind: 'expense',
  date: '2026-06-02',
  description: 'Despensa',
  amount: 100,
  direction: 'out',
  category: 'Despensa',
  categoryIcon: 'SHOPPING_CART',
  fortnightYear: 2026,
  fortnightMonth: 6,
  fortnightPeriod: 'FIRST',
  ...overrides,
});

const movements = [
  movement({ id: 1, description: 'Renta' }),
  movement({ id: 2, kind: 'income', direction: 'in', description: 'Sueldo' }),
];

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
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

afterEach(cleanup);

describe('WalletMovementsFeed filters', () => {
  it('filters by kind with chips', async () => {
    render(<WalletMovementsFeed movements={movements} ownerQueryString="" />);

    expect(screen.getByText('Renta')).toBeTruthy();
    expect(screen.getByText('Sueldo')).toBeTruthy();

    const ingresos = screen.getByRole('button', { name: 'Ingresos' });
    await userEvent.click(ingresos);

    expect(screen.queryByText('Renta')).toBeNull();
    expect(screen.getByText('Sueldo')).toBeTruthy();
    expect(ingresos.getAttribute('aria-pressed')).toBe('true');
  });

  it('adds no tab bar or title of its own', () => {
    render(<WalletMovementsFeed movements={movements} ownerQueryString="" />);

    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Movimientos' })).toBeNull();
  });

  it('offers the add action in the empty state', async () => {
    const onAdd = vi.fn();
    render(
      <WalletMovementsFeed
        movements={[]}
        ownerQueryString=""
        canRegister
        onAddTransaction={onAdd}
      />,
    );

    expect(screen.getByText('Sin movimientos en este periodo')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Agregar movimiento' }));

    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('hides the controls when there is nothing to filter', () => {
    render(<WalletMovementsFeed movements={[]} ownerQueryString="" />);

    expect(screen.queryByRole('group', { name: 'Filtrar por tipo' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
