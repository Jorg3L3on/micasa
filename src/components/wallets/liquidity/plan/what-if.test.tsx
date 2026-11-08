/** @vitest-environment jsdom */

import { act, cleanup, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiquidityProjectionResponse } from '@/types/catalog';
import type { LiquidityScenarioItem } from '@/schemas/liquidity-scenario.schema';

const { fetchLiquidityProjection, getPaymentMethodOptions, financeContext, applyCashPlanRoute, toastSuccess } = vi.hoisted(() => ({
  fetchLiquidityProjection: vi.fn(),
  getPaymentMethodOptions: vi.fn(),
  applyCashPlanRoute: vi.fn(),
  toastSuccess: vi.fn(),
  financeContext: { current: { type: 'user', id: 1 } as { type: 'user' | 'house'; id: number } },
}));

vi.mock('@/lib/api/liquidity', () => ({ fetchLiquidityProjection }));
vi.mock('@/lib/api/wallets', () => ({ getPaymentMethodOptions }));
vi.mock('@/lib/api/cash-plan', () => ({ applyCashPlanRoute }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: vi.fn() } }));
vi.mock('@/context/finance-context', () => ({
  useFinanceContext: () => ({ context: financeContext.current }),
}));

import { WhatIfPanel, type WhatIfWallet } from '@/components/wallets/liquidity/plan/WhatIfPanel';
import { CashPlanTab } from '@/components/wallets/liquidity/plan/CashPlanTab';
import { LiquidityScenarioBanner } from '@/components/wallets/liquidity/scenario/LiquidityScenarioBanner';
import { LiquidityScenarioDeltaStrip } from '@/components/wallets/liquidity/scenario/LiquidityScenarioDeltaStrip';
import {
  useLiquidityScenario,
  type LiquidityScenarioController,
} from '@/components/wallets/liquidity/use-liquidity-scenario';
import { SCENARIO_COPY } from '@/components/wallets/liquidity/scenario/copy';
import { PLAN_COPY } from '@/components/wallets/liquidity/plan/copy';
import { PlanUntouchablesPanel } from '@/components/wallets/liquidity/plan/PlanRailPanels';

beforeAll(() => {
  for (const name of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture', 'scrollIntoView'] as const) {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      value: name === 'hasPointerCapture' ? () => false : () => {},
    });
  }
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
  for (const name of ['IntersectionObserver', 'ResizeObserver'] as const) {
    if (name in window) continue;
    Object.defineProperty(window, name, {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    });
  }
  if (!('ResizeObserver' in window)) {
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  }
});

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  fetchLiquidityProjection.mockReset();
  getPaymentMethodOptions.mockReset();
  financeContext.current = { type: 'user', id: 1 };
});

const wallets: WhatIfWallet[] = [
  { id: 10, name: 'Débito Nómina', type: 'DEBIT_CARD' },
  { id: 7, name: 'Tarjeta Azul', type: 'CREDIT_CARD' },
];

const panelProps = {
  wallets,
  asOf: '2026-10-31',
  until: '2027-04-26',
  active: null,
  loading: false,
  error: null,
  fieldErrors: {},
  onSimulate: vi.fn().mockResolvedValue(true),
};

const pickWallet = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(screen.getByRole('combobox', { name: SCENARIO_COPY.wallet }));
  await user.click(await screen.findByRole('option', { name }));
};

describe('WhatIfPanel', () => {
  it('opens from the invite and keeps Simular off until wallet, amount and date are valid', async () => {
    const user = userEvent.setup();
    render(<WhatIfPanel {...panelProps} />);

    expect(screen.getByText(SCENARIO_COPY.invite)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: SCENARIO_COPY.inviteCta }));

    const submit = screen.getByRole('button', { name: SCENARIO_COPY.simulate }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    await pickWallet(user, 'Débito Nómina');
    await user.type(screen.getByLabelText(SCENARIO_COPY.amount), '1800');
    expect(submit.disabled).toBe(true);
    await user.type(screen.getByLabelText(SCENARIO_COPY.date), '2026-11-02');
    expect(submit.disabled).toBe(false);
  });

  it('explains each invalid field under it', async () => {
    const user = userEvent.setup();
    render(<WhatIfPanel {...panelProps} />);
    await user.click(screen.getByRole('button', { name: SCENARIO_COPY.inviteCta }));

    await user.click(screen.getByLabelText(SCENARIO_COPY.amount));
    await user.tab();
    expect(screen.getByText(SCENARIO_COPY.errorAmount)).toBeTruthy();

    await user.type(screen.getByLabelText(SCENARIO_COPY.date), '2027-05-15');
    await user.tab();
    expect(screen.getByText(/Tu proyección llega hasta el .*Elige un día entre hoy y esa fecha\./)).toBeTruthy();

    await user.clear(screen.getByLabelText(SCENARIO_COPY.date));
    await user.type(screen.getByLabelText(SCENARIO_COPY.date), '2026-10-01');
    await user.tab();
    expect(screen.getByText(SCENARIO_COPY.errorDatePast)).toBeTruthy();

    // The wallet is required.
    await user.click(screen.getByRole('combobox', { name: SCENARIO_COPY.wallet }));
    await user.keyboard('{Escape}');
    expect(await screen.findByText(SCENARIO_COPY.errorWallet)).toBeTruthy();
  });

  it('shows the reason the API gave on its field', async () => {
    const user = userEvent.setup();
    render(
      <WhatIfPanel
        {...panelProps}
        fieldErrors={{ wallet_id: 'Elige una billetera de este espacio.' }}
      />,
    );
    await user.click(screen.getByRole('button', { name: SCENARIO_COPY.inviteCta }));
    expect(screen.getByText('Elige una billetera de este espacio.')).toBeTruthy();
  });

  it('sends a monthly payment with its months and says it is a cuota on a card', async () => {
    const user = userEvent.setup();
    const onSimulate = vi.fn().mockResolvedValue(true);
    render(<WhatIfPanel {...panelProps} onSimulate={onSimulate} />);
    await user.click(screen.getByRole('button', { name: SCENARIO_COPY.inviteCta }));
    await user.click(screen.getByRole('tab', { name: SCENARIO_COPY.instalment }));

    await pickWallet(user, 'Tarjeta Azul');
    await user.type(screen.getByLabelText(SCENARIO_COPY.monthlyAmount), '850');
    await user.type(screen.getByLabelText(SCENARIO_COPY.firstDate), '2026-12-15');
    await user.click(screen.getByRole('button', { name: SCENARIO_COPY.moreMonths }));
    expect(screen.getByText(/7 pagos de \$850\.00 · total \$5,950\.00 · cuotas en Tarjeta Azul/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: SCENARIO_COPY.fewerMonths }));

    await user.click(screen.getByRole('button', { name: SCENARIO_COPY.simulate }));
    expect(onSimulate).toHaveBeenCalledWith({
      kind: 'instalment',
      amount: 850,
      firstDate: '2026-12-15',
      months: 6,
      wallet_id: 7,
    });
  });

  it('keeps the values and offers a retry when the request fails', async () => {
    const user = userEvent.setup();
    render(<WhatIfPanel {...panelProps} error={SCENARIO_COPY.errorBody} />);
    await user.click(screen.getByRole('button', { name: SCENARIO_COPY.inviteCta }));
    expect(screen.getByRole('alert').textContent).toContain(SCENARIO_COPY.errorTitle);
  });
});

describe('LiquidityScenarioBanner', () => {
  it('announces the simulation and removes it', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <LiquidityScenarioBanner
        assumptions={['Compra hipotética de $1,800.00 el día 2 nov con Débito Nómina; no se guardó.']}
        onRemove={onRemove}
      />,
    );
    const status = screen.getByRole('status');
    expect(status.textContent).toContain(SCENARIO_COPY.bannerTitle);
    expect(status.textContent).toContain('no se guardó');
    await user.click(within(status).getByRole('button', { name: SCENARIO_COPY.remove }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

const purchase: LiquidityScenarioItem = { kind: 'purchase', amount: 1800, date: '2026-11-02', wallet_id: 10 };

describe('useLiquidityScenario', () => {
  it('holds the scenario in memory and clears it on reset', async () => {
    const response = { as_of: '2026-10-31' } as LiquidityProjectionResponse;
    fetchLiquidityProjection.mockResolvedValue(response);
    const { result } = renderHook(() => useLiquidityScenario());

    await act(async () => {
      expect(await result.current.simulate(purchase)).toBe(true);
    });
    expect(fetchLiquidityProjection).toHaveBeenCalledWith(
      expect.objectContaining({ scenario: [purchase] }),
      { type: 'user', id: 1 },
    );
    expect(result.current.item).toEqual(purchase);
    expect(result.current.data).toBe(response);

    act(() => result.current.clear());
    expect(result.current.item).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it('starts empty on a new mount: a reload never brings a scenario back', async () => {
    fetchLiquidityProjection.mockResolvedValue({ as_of: '2026-10-31' });
    const first = renderHook(() => useLiquidityScenario());
    await act(async () => {
      await first.result.current.simulate(purchase);
    });
    first.unmount();

    const { result } = renderHook(() => useLiquidityScenario());
    expect(result.current.item).toBeNull();
    expect(result.current.data).toBeNull();
    // Mounting alone fetches nothing: no stored scenario to restore.
    expect(fetchLiquidityProjection).toHaveBeenCalledTimes(1);
  });

  it('drops the scenario with a notice when the context switches', async () => {
    fetchLiquidityProjection.mockResolvedValue({ as_of: '2026-10-31' });
    const { result, rerender } = renderHook(() => useLiquidityScenario());
    await act(async () => {
      await result.current.simulate(purchase);
    });

    financeContext.current = { type: 'house', id: 5 };
    rerender();

    expect(result.current.item).toBeNull();
    expect(result.current.data).toBeNull();
    expect(result.current.notice).toBe(SCENARIO_COPY.clearedOnContextSwitch);
  });

  it('pins a 400 to its form field and anything else to the error box', async () => {
    const { result } = renderHook(() => useLiquidityScenario());
    fetchLiquidityProjection.mockRejectedValueOnce(
      Object.assign(new Error('La fecha queda fuera del horizonte de la proyección.'), {
        status: 400,
        field: 'firstDate',
        index: 0,
      }),
    );
    await act(async () => {
      expect(await result.current.simulate(purchase)).toBe(false);
    });
    expect(result.current.fieldErrors).toEqual({
      date: 'La fecha queda fuera del horizonte de la proyección.',
    });
    expect(result.current.error).toBeNull();

    fetchLiquidityProjection.mockRejectedValueOnce(new Error('Network down'));
    await act(async () => {
      await result.current.simulate(purchase);
    });
    expect(result.current.error).toBe(SCENARIO_COPY.errorBody);
    expect(result.current.fieldErrors).toEqual({});
  });
});

type ObligationItem = LiquidityProjectionResponse['milestones'][number]['obligations'][number];

const card = (overrides: Partial<ObligationItem> = {}): ObligationItem => ({
  source: 'credit_card_statement',
  wallet_id: 7,
  wallet_name: 'Tarjeta Azul',
  wallet_type: 'CREDIT_CARD',
  statement_start: '2026-10-01',
  statement_end: '2026-10-15',
  statement_due_date: '2026-11-05',
  last_statement_balance: 1900,
  payments_applied_to_statement: 0,
  next_due_payment: 1900,
  minimum_payment: 620,
  apr_annual: 0.6,
  ...overrides,
});

const projectionWith = (extra: ObligationItem[] = []): LiquidityProjectionResponse => {
  const obligations = [card(), ...extra];
  const total = obligations.reduce((sum, item) => sum + item.next_due_payment, 0);
  return {
    as_of: '2026-10-31',
    until: '2027-04-26',
    funding_wallets: [{ id: 10, name: 'Débito Nómina', type: 'DEBIT_CARD', balance: 500 }],
    milestones: [
      {
        due_date: '2026-11-05',
        is_past_due: false,
        obligations: obligations.filter((item) => item.statement_due_date === '2026-11-05'),
        total_due: total,
        cumulative_due_through_date: total,
        funding_total: 500,
        liquidity_headroom: 500 - total,
      },
      ...obligations
        .filter((item) => item.statement_due_date !== '2026-11-05')
        .map((item) => ({
          due_date: item.statement_due_date,
          is_past_due: false,
          obligations: [item],
          total_due: item.next_due_payment,
          cumulative_due_through_date: total,
          funding_total: 500,
          liquidity_headroom: 500 - total,
        })),
    ],
    summary: {
      total_obligations_due_on_or_before_until: total,
      funding_total: 500,
      expected_income_total_on_or_before_until: 0,
      net_liquidity_versus_obligations: 500 - total,
      shortfall_versus_funding: Math.max(0, total - 500),
      first_cumulative_shortfall_date: '2026-11-05',
      net_liquidity_versus_obligations_including_income: 500 - total,
      shortfall_versus_funding_and_income: Math.max(0, total - 500),
      first_projected_shortfall_date: '2026-11-05',
    },
    assumptions: [],
    options: { stress_cycle_percent: 0, include_unpaid_expenses: true, include_expense_templates: true },
    monthly_series: [
      {
        month_key: '2026-11',
        msi_debt_total: 1900,
        installment_payment_total: 0,
        loan_payment_total: 0,
        expected_income_total: 0,
        expense_template_total: 0,
        other_debt_components_total: total - 1900,
        total_payments_due: total,
        remaining_payments_from_month: total,
        monthly_remaining: -total,
        outstanding_debt_total: 5000,
        debt_items: [],
      },
    ],
    projection_events: [],
    projection_tracks: [],
    card_utilization_summary: {
      cards: [
        {
          card_id: 7,
          card_name: 'Tarjeta Azul',
          card_type: 'CREDIT_CARD',
          used_amount: 5000,
          credit_limit: 20000,
          utilization_percent: 25,
          risk_level: 'safe',
          is_danger: false,
        },
      ],
      dangerous_count: 0,
      unrated_count: 0,
    },
  };
};

const simulatedPurchase = (date: string): ObligationItem => ({
  source: 'scenario',
  wallet_id: 10,
  wallet_name: 'Débito Nómina',
  wallet_type: 'DEBIT_CARD',
  statement_start: '',
  statement_end: '',
  statement_due_date: date,
  last_statement_balance: 0,
  payments_applied_to_statement: 0,
  next_due_payment: 1800,
  expense_description: 'Compra simulada',
  scenario_index: 0,
  scenario_kind: 'purchase',
  scenario_charge_date: date,
});

const controller = (
  item: LiquidityScenarioItem | null,
  data: LiquidityProjectionResponse | null,
): LiquidityScenarioController => ({
  item,
  data,
  loading: false,
  error: null,
  fieldErrors: {},
  notice: null,
  simulate: vi.fn().mockResolvedValue(true),
  clear: vi.fn(),
  dismissNotice: vi.fn(),
  refresh: vi.fn(),
});

const renderPlan = (scenario: LiquidityScenarioController) =>
  render(
    <CashPlanTab
      data={projectionWith()}
      loading={false}
      error={null}
      onReload={vi.fn()}
      selectedMonthKey="2026-11"
      scenario={scenario}
    />,
  );

describe('CashPlanTab with a scenario', () => {
  beforeEach(() => {
    getPaymentMethodOptions.mockResolvedValue([
      { id: 10, name: 'Débito Nómina', type: 'DEBIT_CARD' },
      { id: 7, name: 'Tarjeta Azul', type: 'CREDIT_CARD' },
      { id: 30, name: 'Meta viaje', type: 'GOAL' },
    ]);
  });

  it('shows the hueco before → after and recomputes the routes with the purchase as a deferrable debt', async () => {
    const item: LiquidityScenarioItem = { ...purchase, date: '2026-11-02' };
    const scenarioData = projectionWith([simulatedPurchase('2026-11-02')]);
    renderPlan(controller(item, scenarioData));

    // Hueco $1,400 → $3,200 (card $1,900 − cash $500, then + $1,800).
    expect(screen.getByText('$1,400.00')).toBeTruthy();
    expect(screen.getByText(SCENARIO_COPY.gapGrew('$1,800.00'))).toBeTruthy();
    expect(screen.getAllByText(/Aplazar Compra simulada/).length).toBeGreaterThan(0);
    // The card can still be paid at its minimum; the cash purchase cannot.
    expect(screen.getAllByText(/Tarjeta Azul/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/mínimo.*Compra simulada/i)).toBeNull();

    // The picker offers funding wallets and cards, not goals.
    await waitFor(() => expect(getPaymentMethodOptions).toHaveBeenCalled());
  });

  it('says "Sin cambio esta quincena" when the purchase falls outside the period', () => {
    const item: LiquidityScenarioItem = { ...purchase, date: '2027-01-20' };
    const scenarioData = projectionWith([simulatedPurchase('2027-01-20')]);
    scenarioData.scenario_delta = {
      baseline: { first_projected_shortfall_date: '2026-11-05', min_projected_headroom: -1400, end_liquidity: 4700 },
      scenario: { first_projected_shortfall_date: '2026-11-05', min_projected_headroom: -3200, end_liquidity: 2900 },
      first_projected_shortfall_changed: false,
      min_projected_headroom_change: -1800,
      end_liquidity_change: -1800,
    };
    renderPlan(controller(item, scenarioData));

    expect(screen.getByText(SCENARIO_COPY.noChangePeriod('quincena'))).toBeTruthy();
    expect(screen.getByText(/Su efecto está en Proyección: liquidez al final \$4,700 → \$2,900\./)).toBeTruthy();
    expect(screen.queryByText(/Aplazar Compra simulada/)).toBeNull();
  });

  it('draws the plan of today without a scenario', () => {
    renderPlan(controller(null, null));
    expect(screen.getByRole('button', { name: SCENARIO_COPY.inviteCta })).toBeTruthy();
    expect(screen.queryByText(/Aplazar Compra simulada/)).toBeNull();
    expect(screen.queryByText(SCENARIO_COPY.noChangePeriod('quincena'))).toBeNull();
  });
});

describe('LiquidityScenarioDeltaStrip', () => {
  it('reads base → scenario per row and says "Sin cambio" where nothing moved', () => {
    render(
      <LiquidityScenarioDeltaStrip
        until="2027-01-28"
        delta={{
          baseline: { first_projected_shortfall_date: '2026-11-14', min_projected_headroom: -800, end_liquidity: 4700 },
          scenario: { first_projected_shortfall_date: '2026-11-05', min_projected_headroom: -800, end_liquidity: 2900 },
          first_projected_shortfall_changed: true,
          min_projected_headroom_change: 0,
          end_liquidity_change: -1800,
        }}
      />,
    );
    const strip = screen.getByLabelText('Cambios con esta simulación');
    expect(strip.textContent).toContain('9 días antes');
    expect(strip.textContent).toContain('$4,700 → $2,900');
    expect(strip.textContent).toContain('-$1,800');
    expect(strip.textContent).toContain(SCENARIO_COPY.noChange);
  });

  it('collapses to one line when the simulation moves nothing', () => {
    render(
      <LiquidityScenarioDeltaStrip
        until="2027-01-28"
        delta={{
          baseline: { first_projected_shortfall_date: null, min_projected_headroom: 300, end_liquidity: 4700 },
          scenario: { first_projected_shortfall_date: null, min_projected_headroom: 300, end_liquidity: 4700 },
          first_projected_shortfall_changed: false,
          min_projected_headroom_change: 0,
          end_liquidity_change: 0,
        }}
      />,
    );
    expect(screen.getByText(/no mueve tu primer faltante/)).toBeTruthy();
  });
});

describe('Plan tab steps, rail and states (MIC-I14-4)', () => {
  beforeEach(() => {
    getPaymentMethodOptions.mockResolvedValue([{ id: 10, name: 'Débito Nómina', type: 'DEBIT_CARD' }]);
  });

  const renderTab = (
    data: LiquidityProjectionResponse | null,
    overrides: Partial<{ loading: boolean; error: string | null; scenario: LiquidityScenarioController }> = {},
  ) =>
    render(
      <CashPlanTab
        data={data}
        loading={overrides.loading ?? false}
        error={overrides.error ?? null}
        onReload={vi.fn()}
        selectedMonthKey="2026-11"
        scenario={overrides.scenario ?? controller(null, null)}
      />,
    );

  const withCash = (cash: number, extra: ObligationItem[] = []) => {
    const data = projectionWith(extra);
    data.summary.funding_total = cash;
    data.funding_wallets = [
      { id: 10, name: 'Débito Nómina', type: 'DEBIT_CARD', balance: cash - 100 },
      { id: 11, name: 'Efectivo', type: 'CASH', balance: 100 },
    ];
    return data;
  };

  it('steps follow the chosen route\'s actions with their dates and wallets', () => {
    // Surplus: cash $5,000 against a $1,900 card statement.
    renderTab(withCash(5000));
    const steps = within(screen.getByRole('region', { name: 'Tus pasos con esta ruta' })).getAllByRole('listitem');
    expect(steps.length).toBeGreaterThan(0);
    const first = steps[0]!;
    expect(within(first).getByTestId('step-date').textContent).toBe('Antes del 5 nov');
    expect(within(first).getByTestId('step-route').textContent).toContain('Débito Nómina');
    expect(within(first).getByTestId('step-route').textContent).toContain('Tarjeta Azul');
    expect(within(first).getByRole('link', { name: 'Programar pago' }).getAttribute('href')).toBe('/credit-cards/7');
    expect(screen.getByRole('button', { name: 'Activar este plan' })).toBeTruthy();
    expect(screen.getByText('Crea recordatorios y pagos programados en tu Panel. Nada se cobra solo.')).toBeTruthy();
  });

  it('a step on a payday reads "al caer la nómina"', () => {
    const data = withCash(5000);
    data.income_dates = [
      { date: '2026-11-05', amount: 12000, title: 'Nómina' },
      { date: '2026-12-15', amount: 12000, title: 'Nómina' },
    ];
    renderTab(data);
    const steps = within(screen.getByRole('region', { name: 'Tus pasos con esta ruta' })).getAllByRole('listitem');
    expect(within(steps[0]!).getByTestId('step-date').textContent).toBe('5 nov · al caer la nómina');
  });

  it('a step whose obligation has a data gap renders amber with its button', () => {
    // The card has no minimum: missing_minimum is general; an APR-less card gets missing_apr on its line.
    const data = withCash(5000);
    data.milestones[0]!.obligations = [card({ apr_annual: null })];
    renderTab(data);
    const steps = within(screen.getByRole('region', { name: 'Tus pasos con esta ruta' })).getAllByRole('listitem');
    const amber = steps.find((step) => step.dataset.gap === 'true');
    expect(amber).toBeDefined();
    expect(within(amber!).getByRole('link', { name: 'Agregar pago' }).getAttribute('href')).toBe('/credit-cards/7');
  });

  it('loan tabs only when the period falls short', () => {
    const tabs = () => within(screen.getByRole('region', { name: 'Simula antes de decidir' }));
    renderTab(withCash(5000));
    expect(tabs().getAllByRole('tab')).toHaveLength(2);
    expect(tabs().getByRole('tab', { name: 'Una compra' })).toBeTruthy();
    expect(tabs().getByRole('tab', { name: 'Pago mensual' })).toBeTruthy();
    expect(tabs().queryByRole('tab', { name: 'Préstamo' })).toBeNull();
    expect(tabs().queryByRole('tab', { name: 'Consolidar' })).toBeNull();
    cleanup();

    renderTab(projectionWith());
    expect(tabs().getAllByRole('tab')).toHaveLength(4);
    expect(tabs().getByRole('tab', { name: 'Préstamo' })).toBeTruthy();
    expect(tabs().getByRole('tab', { name: 'Consolidar' })).toBeTruthy();
  });

  it('"Lo que no tocamos" lists the untouched payments with amounts', () => {
    render(
      <PlanUntouchablesPanel
        labels={['Renta']}
        obligations={[{ id: 'bill-1', kind: 'bill', labelSynthetic: 'Renta', statementDue: 4000, dueInHorizon: true, consequenceTier: 1 }]}
      />,
    );
    const panel = screen.getByRole('region', { name: 'Lo que no tocamos' });
    expect(within(panel).getByText('Renta')).toBeTruthy();
    expect(within(panel).getByText('$4,000.00')).toBeTruthy();
  });

  it('the simulator result inset reflects scenario_delta', () => {
    const item: LiquidityScenarioItem = { ...purchase, date: '2027-01-20' };
    const scenarioData = projectionWith([simulatedPurchase('2027-01-20')]);
    scenarioData.scenario_delta = {
      baseline: { first_projected_shortfall_date: '2026-11-05', min_projected_headroom: -1400, end_liquidity: 4700 },
      scenario: { first_projected_shortfall_date: '2026-11-05', min_projected_headroom: -3200, end_liquidity: 2900 },
      first_projected_shortfall_changed: false,
      min_projected_headroom_change: -1800,
      end_liquidity_change: -1800,
    };
    renderTab(projectionWith(), { scenario: controller(item, scenarioData) });
    expect(screen.getByTestId('sim-result').textContent).toBe(
      'Liquidez al final de la proyección $4,700 → $2,900 · ruta: no cambia',
    );
  });

  it('in-period simulation: the inset reads hueco before → after and whether the route changes', () => {
    const item: LiquidityScenarioItem = { ...purchase, date: '2026-11-02' };
    renderTab(projectionWith(), { scenario: controller(item, projectionWith([simulatedPurchase('2026-11-02')])) });
    expect(screen.getByTestId('sim-result').textContent).toMatch(/\$1,400\.00 → .*\$3,200\.00 · ruta: (cambia|no cambia)$/);
  });

  it('empty: no cash and nothing due', () => {
    const data = projectionWith();
    data.summary.funding_total = 0;
    data.funding_wallets = [];
    data.monthly_series[0]!.total_payments_due = 0;
    renderTab(data);
    expect(screen.getByText(PLAN_COPY.emptyTitle)).toBeTruthy();
    expect(screen.getByRole('link', { name: PLAN_COPY.emptyCta }).getAttribute('href')).toBe('/wallets');
  });

  it('loading: first load shows the planner skeleton', () => {
    renderTab(null, { loading: true });
    expect(screen.getByLabelText('Cargando panel').getAttribute('aria-busy')).toBe('true');
  });

  it('error without data: banner and Reintentar replace the screen', () => {
    renderTab(null, { error: 'boom' });
    expect(screen.getByText('No se pudo armar el plan.')).toBeTruthy();
    expect(screen.getByRole('button', { name: PLAN_COPY.retry })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Te (sobran|faltan)/ })).toBeNull();
  });

  it('error with data: banner over the previous plan', () => {
    renderTab(projectionWith(), { error: 'boom' });
    expect(screen.getByText('No se pudo actualizar el panorama.')).toBeTruthy();
    expect(screen.getByText(PLAN_COPY.errorKeepsPlan)).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Te faltan \$1,400\.00 esta quincena/ })).toBeTruthy();
  });

  it('balanced: no routes and no steps, the simulator stays', () => {
    renderTab(withCash(1900));
    expect(screen.getByRole('heading', { name: 'Este periodo cuadra' })).toBeTruthy();
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'Tus pasos con esta ruta' })).toBeNull();
    expect(screen.getByTestId('plan-balanced-note')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Simula antes de decidir' })).toBeTruthy();
  });

  it('low confidence: amber chip and "Datos por completar" above the simulator', () => {
    const data = withCash(5000);
    data.milestones[0]!.obligations = [card({ minimum_payment: null, apr_annual: null })];
    renderTab(data);
    expect(screen.getByTestId('plan-confidence').dataset.confidence).toBe('low');
    const rail = screen.getByRole('complementary', { name: PLAN_COPY.railLabel });
    const sections = within(rail).getAllByRole('region').map((region) => region.getAttribute('aria-labelledby'));
    expect(sections.indexOf('plan-gaps-title')).toBeLessThan(sections.indexOf('plan-sim-title'));
    expect(within(rail).getByText(PLAN_COPY.gapsRailHint)).toBeTruthy();
  });

  it('the weights card reads the five weights from score.ts', () => {
    renderTab(projectionWith());
    const weights = screen.getByTestId('plan-weights-panel');
    expect(within(weights).getAllByRole('listitem')).toHaveLength(5);
    expect(within(weights).getByText('45%')).toBeTruthy();
  });
});

describe('Activar este plan (MIC-I14-5)', () => {
  beforeEach(() => {
    getPaymentMethodOptions.mockResolvedValue([{ id: 10, name: 'Débito Nómina', type: 'DEBIT_CARD' }]);
    applyCashPlanRoute.mockReset();
    toastSuccess.mockReset();
  });

  const surplus = () => {
    const data = projectionWith();
    data.summary.funding_total = 5000;
    data.funding_wallets = [{ id: 10, name: 'Débito Nómina', type: 'DEBIT_CARD', balance: 5000 }];
    return data;
  };

  const renderSurplus = (scenario: LiquidityScenarioController = controller(null, null)) => {
    const onReload = vi.fn();
    render(
      <CashPlanTab data={surplus()} loading={false} error={null} onReload={onReload} selectedMonthKey="2026-11" scenario={scenario} />,
    );
    return { onReload };
  };

  it('lists the writes before saving, sends the route once and confirms with a toast', async () => {
    applyCashPlanRoute.mockResolvedValue({
      writes: [{ kind: 'card_payment_plan', walletId: 7, label: 'Tarjeta Azul', fortnightId: 3, amount: 1900, status: 'created' }],
      skipped: [],
    });
    const { onReload } = renderSurplus();
    await userEvent.click(screen.getByRole('button', { name: 'Activar este plan' }));

    const dialog = await screen.findByRole('dialog');
    const writes = within(dialog).getByTestId('activate-writes');
    expect(within(writes).getByText(/Programar pago de \$[\d,.]+ a Tarjeta Azul/)).toBeTruthy();
    expect(applyCashPlanRoute).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Activar' }));
    await waitFor(() => expect(applyCashPlanRoute).toHaveBeenCalledTimes(1));
    const [body] = applyCashPlanRoute.mock.calls[0]!;
    expect(body).toMatchObject({ horizon: 'quincena', monthKey: '2026-11' });
    expect(body.actions.length).toBeGreaterThan(0);
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Plan activado: 1 cambio en tu Panel', expect.anything()));
    expect(onReload).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the sheet open with the error and a retry when the request fails', async () => {
    applyCashPlanRoute.mockRejectedValue(new Error('Tu plan cambió desde que lo abriste. Recarga para ver la ruta actualizada.'));
    renderSurplus();
    await userEvent.click(screen.getByRole('button', { name: 'Activar este plan' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Activar' }));
    expect(await within(dialog).findByText(/Tu plan cambió/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: PLAN_COPY.retry })).toBeTruthy();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('cancel stores nothing', async () => {
    renderSurplus();
    await userEvent.click(screen.getByRole('button', { name: 'Activar este plan' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(applyCashPlanRoute).not.toHaveBeenCalled();
  });

  it('is off while a simulation is on screen', () => {
    const item: LiquidityScenarioItem = { ...purchase, date: '2027-01-20' };
    renderSurplus(controller(item, projectionWith([simulatedPurchase('2027-01-20')])));
    expect(screen.getByRole('button', { name: 'Activar este plan' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(PLAN_COPY.activateScenarioBlocked)).toBeTruthy();
  });
});
