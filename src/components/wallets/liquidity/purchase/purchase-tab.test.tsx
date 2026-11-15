/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { fakeSimulation, TEST_WALLETS } from '@/components/wallets/liquidity/purchase/test-fixtures';

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
import { DEBOUNCE_MS } from '@/components/wallets/liquidity/purchase/use-purchase-simulation';

const today = todayCalendarDate();
const posts = () => clientFetchFromApi.mock.calls.filter((c) => c[1]?.method === 'POST');

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
  clientFetchFromApi.mockImplementation(async (url: string, init?: RequestInit) => {
    if (!init || init.method !== 'POST') return { wallets: TEST_WALLETS };
    return fakeSimulation(JSON.parse(String(init.body)), today);
  });
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
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS + 50);
  });
};

describe('Simular compra tab', () => {
  it('shows the empty state until there is a price', async () => {
    render(<PurchaseSimulatorTab />);
    expect(await screen.findByText(PURCHASE_COPY.emptyTitle)).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it('sends one request after the debounce, and one more per change', async () => {
    render(<PurchaseSimulatorTab />);
    await screen.findByText(PURCHASE_COPY.emptyTitle);
    typeTotal('6000');
    await settle();
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(String(posts()[0][1].body))).toMatchObject({ total: 6000, mode: 'msi', wallet_id: 7, months: 12 });

    fireEvent.mouseDown(screen.getByRole('tab', { name: '18 meses' }));
    fireEvent.click(screen.getByRole('tab', { name: '18 meses' }));
    await settle();
    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(JSON.parse(String(posts()[1][1].body)).months).toBe(18);
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
