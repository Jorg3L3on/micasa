/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { fakeBaseline, TEST_WALLETS } from '@/components/wallets/liquidity/purchase/test-fixtures';
import { defaultBaselineUntil } from '@/lib/finance/purchase-simulation/simulate';

const { clientFetchFromApi, financeContext, isMobile } = vi.hoisted(() => ({
  clientFetchFromApi: vi.fn(),
  financeContext: { current: { type: 'user', id: 1 } as { type: 'user' | 'house'; id: number } },
  isMobile: { current: false },
}));

vi.mock('@/lib/api/client-fetch', async (orig) => ({
  ...(await orig<typeof import('@/lib/api/client-fetch')>()),
  clientFetchFromApi,
}));
vi.mock('@/context/finance-context', () => ({ useFinanceContext: () => ({ context: financeContext.current }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => isMobile.current }));
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock('next/image', () => ({ default: () => null }));

import { PurchaseSimulatorTab } from '@/components/wallets/liquidity/purchase/PurchaseSimulatorTab';
import { PURCHASE_COPY } from '@/components/wallets/liquidity/purchase/copy';

const today = todayCalendarDate();
const loads = () => clientFetchFromApi.mock.calls.map((c) => String(c[0]));

beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }) });
  }
  for (const name of ['ResizeObserver', 'IntersectionObserver'] as const) {
    if (!(name in window)) Object.defineProperty(window, name, { configurable: true, value: class { observe() {} unobserve() {} disconnect() {} } });
  }
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  financeContext.current = { type: 'user', id: 1 };
  isMobile.current = false;
  clientFetchFromApi.mockReset();
  clientFetchFromApi.mockImplementation(async (url: string) => {
    const until = new URL(url, 'http://test').searchParams.get('until') ?? defaultBaselineUntil(today);
    return { wallets: TEST_WALLETS, baseline: fakeBaseline(today, until) };
  });
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const typeTotal = (value: string) => {
  fireEvent.change(screen.getByLabelText('Precio total en pesos'), { target: { value } });
};

const settle = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
};

describe('Simular compra tab', () => {
  it('shows the empty state until there is a price', async () => {
    render(<PurchaseSimulatorTab />);
    expect(await screen.findByText(PURCHASE_COPY.emptyTitle)).toBeTruthy();
    expect(loads()).toHaveLength(1);
  });

  it('loads the quincenas once and recalculates every change without asking again', async () => {
    render(<PurchaseSimulatorTab />);
    await screen.findByText(PURCHASE_COPY.emptyTitle);
    typeTotal('6000');
    expect(await screen.findByText(/aprieta/)).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('tab', { name: '3 meses' }));
    fireEvent.click(screen.getByRole('tab', { name: '3 meses' }));
    expect(await screen.findByText(/Pagas cada mes/i)).toBeTruthy();
    expect(screen.getAllByText('$2,000.00').length).toBeGreaterThan(0);
    expect(loads()).toHaveLength(1);
  });

  it('loads more quincenas only when the plan ends after them', async () => {
    render(<PurchaseSimulatorTab />);
    await screen.findByText(PURCHASE_COPY.emptyTitle);
    fireEvent.mouseDown(screen.getByRole('tab', { name: PURCHASE_COPY.modeCredito }));
    fireEvent.click(screen.getByRole('tab', { name: PURCHASE_COPY.modeCredito }));
    typeTotal('300000');
    await waitFor(() => expect(loads()).toHaveLength(2));
    expect(loads()[1]).toMatch(/until=\d{4}-12-30|until=\d{4}-12-29/);
  });

  it('keeps the form in this browser tab after a reload', async () => {
    const first = render(<PurchaseSimulatorTab />);
    await screen.findByText(PURCHASE_COPY.emptyTitle);
    typeTotal('6000');
    await screen.findByText(/aprieta/);
    first.unmount();
    render(<PurchaseSimulatorTab />);
    expect(await screen.findByText(/aprieta/)).toBeTruthy();
  });

  it('shows the verdict with its reason and always the disclaimer', async () => {
    render(<PurchaseSimulatorTab />);
    await screen.findByText(PURCHASE_COPY.emptyTitle);
    typeTotal('6000');
    await settle();
    expect(await screen.findByText('Te alcanza, pero aprieta 2 quincenas')).toBeTruthy();
    expect(screen.getByRole('heading', { name: PURCHASE_COPY.verdictEyebrow })).toBeTruthy();
    expect(screen.getByText(PURCHASE_COPY.chip.amber)).toBeTruthy();
    expect(screen.getAllByText(PURCHASE_COPY.disclaimer).length).toBeGreaterThan(0);
    expect(screen.getByText(/2ª de diciembre y la 2ª de enero quedarían en rojo/)).toBeTruthy();
  });

  it('hides the detail until Ver detalle, then shows the tightest quincena and follows the selected row', async () => {
    render(<PurchaseSimulatorTab />);
    await screen.findByText(PURCHASE_COPY.emptyTitle);
    typeTotal('6000');
    await settle();
    await screen.findByText(/aprieta/);
    const q = screen.getByRole('region', { name: PURCHASE_COPY.quincenaTitle });
    expect(within(q).queryByRole('heading', { level: 3 })).toBeNull();
    fireEvent.click(within(q).getByRole('button', { name: PURCHASE_COPY.showDetail }));
    const before = within(q).getByRole('heading', { level: 3 }).textContent;
    expect(before).toMatch(/2ª quincena de diciembre/);
    const table = screen.getByRole('region', { name: PURCHASE_COPY.tableTitle.quincena });
    const first = within(table).getAllByRole('button', { pressed: false })[0];
    fireEvent.click(first);
    expect(within(q).getByRole('heading', { level: 3 }).textContent).not.toBe(before);
  });

  it('clears the simulation with a notice when the context changes', async () => {
    const view = render(<PurchaseSimulatorTab />);
    await screen.findByText(PURCHASE_COPY.emptyTitle);
    typeTotal('6000');
    await settle();
    await screen.findByText(/aprieta/);
    financeContext.current = { type: 'house', id: 9 };
    view.rerender(<PurchaseSimulatorTab />);
    expect(await screen.findByText(PURCHASE_COPY.clearedOnContextSwitch)).toBeTruthy();
    expect(await screen.findByText(PURCHASE_COPY.emptyTitle)).toBeTruthy();
  });

  it('every form control is a real button or input reachable by keyboard', async () => {
    render(<PurchaseSimulatorTab />);
    await screen.findByText(PURCHASE_COPY.emptyTitle);
    const modes = screen.getByRole('tablist', { name: PURCHASE_COPY.how });
    for (const name of [PURCHASE_COPY.modeContado, PURCHASE_COPY.modeMsi, PURCHASE_COPY.modeCredito]) {
      const el = within(modes).getByRole('tab', { name });
      expect(el.tagName).toBe('BUTTON');
      expect(el.className).toMatch(/min-h-11/);
    }
    // The wallet choice is one select (combobox), not a list of every wallet.
    expect(screen.getByRole('combobox', { name: PURCHASE_COPY.whichCard })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /Tarjeta Dos/ })).toBeNull();
  });
});
