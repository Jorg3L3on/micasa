import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiquidityProjectionResponse } from '@/types/catalog';

const { getOwnerContext, getLiquidityProjection, applyCashPlan, prismaMock } = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  getLiquidityProjection: vi.fn(),
  applyCashPlan: vi.fn(),
  prismaMock: {
    wallet: { findFirst: vi.fn() },
    loan: { findFirst: vi.fn() },
    expense: { findFirst: vi.fn() },
    expenseTemplate: { findFirst: vi.fn() },
  },
}));

vi.mock('@/lib/server/get-owner-context', () => ({ getOwnerContext }));
vi.mock('@/lib/finance/liquidity-projection.service', () => ({ getLiquidityProjection }));
vi.mock('@/lib/finance/cash-plan/apply-plan.service', () => ({ applyCashPlan }));
vi.mock('@/lib/prisma', () => ({ default: prismaMock }));

import { POST } from './route';
import { buildCashPlan, planInputFromLiquidity } from '@/lib/finance/cash-plan';
import { parseCalendarDate } from '@/lib/calendar-dates';

const ownerContext = {
  userId: 1,
  ownerType: 'user' as const,
  ownerId: 1,
  ownerFilter: { user_id: 1, house_id: null },
  role: 'owner' as const,
};

/** Synthetic projection: one card due this quincena and cash that covers it (surplus). */
const projection = (): LiquidityProjectionResponse => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    as_of: today,
    until: '2099-12-31',
    funding_wallets: [{ id: 10, name: 'Débito', type: 'DEBIT_CARD', balance: 6000 }],
    milestones: [
      {
        due_date: today,
        is_past_due: false,
        obligations: [
          {
            source: 'credit_card_statement',
            wallet_id: 7,
            wallet_name: 'Tarjeta A',
            wallet_type: 'CREDIT_CARD',
            statement_start: today,
            statement_end: today,
            statement_due_date: today,
            last_statement_balance: 1900,
            payments_applied_to_statement: 0,
            next_due_payment: 1900,
            minimum_payment: 620,
            apr_annual: 0.6,
          },
        ],
        total_due: 1900,
        cumulative_due_through_date: 1900,
        funding_total: 6000,
        liquidity_headroom: 4100,
      },
    ],
    summary: {
      total_obligations_due_on_or_before_until: 1900,
      funding_total: 6000,
      expected_income_total_on_or_before_until: 0,
      net_liquidity_versus_obligations: 4100,
      shortfall_versus_funding: 0,
      first_cumulative_shortfall_date: null,
      net_liquidity_versus_obligations_including_income: 4100,
      shortfall_versus_funding_and_income: 0,
      first_projected_shortfall_date: null,
    },
    assumptions: [],
    options: { stress_cycle_percent: 0, include_unpaid_expenses: true, include_expense_templates: true },
    monthly_series: [
      {
        month_key: today.slice(0, 7),
        msi_debt_total: 0,
        installment_payment_total: 0,
        loan_payment_total: 0,
        expected_income_total: 0,
        expense_template_total: 0,
        other_debt_components_total: 1900,
        total_payments_due: 1900,
        remaining_payments_from_month: 1900,
        monthly_remaining: -1900,
        outstanding_debt_total: 5000,
        debt_items: [],
      },
    ],
    projection_events: [],
    projection_tracks: [],
    card_utilization_summary: {
      cards: [
        { card_id: 7, card_name: 'Tarjeta A', card_type: 'CREDIT_CARD', used_amount: 5000, credit_limit: 20000, utilization_percent: 25, risk_level: 'safe', is_danger: false },
      ],
      dangerous_count: 0,
      unrated_count: 0,
    },
  } as LiquidityProjectionResponse;
};

/** What the client would send: the primary route as the browser computed it. */
const clientBody = () => {
  const data = projection();
  const input = planInputFromLiquidity({
    projection: data,
    monthKey: data.as_of.slice(0, 7),
    horizon: 'quincena',
    asOfYmd: data.as_of,
    computedAt: parseCalendarDate(data.as_of).toISOString(),
  });
  const plan = buildCashPlan(input);
  return {
    horizon: 'quincena' as const,
    monthKey: data.as_of.slice(0, 7),
    routeId: plan.primary.id,
    actions: plan.primary.actions.map((step) => ({ type: step.type, obligationId: step.obligationId ?? null, amount: step.amount ?? null })),
  };
};

const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/wallets/liquidity/plan/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as Parameters<typeof POST>[0],
  );

describe('POST /api/wallets/liquidity/plan/apply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(ownerContext);
    getLiquidityProjection.mockResolvedValue(projection());
    applyCashPlan.mockResolvedValue({ writes: [], skipped: [] });
    prismaMock.wallet.findFirst.mockResolvedValue({ id: 7 });
    prismaMock.loan.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.expense.findFirst.mockResolvedValue({ id: 1 });
    prismaMock.expenseTemplate.findFirst.mockResolvedValue(null);
  });

  it('applies the route when it matches the recomputed plan', async () => {
    const body = clientBody();
    expect(body.actions.length).toBeGreaterThan(0);
    const response = await post(body);
    expect(response.status).toBe(200);
    expect(applyCashPlan).toHaveBeenCalledTimes(1);
    expect(applyCashPlan.mock.calls[0]![0].ownerFilter).toEqual(ownerContext.ownerFilter);
  });

  it("another owner's wallet → 400", async () => {
    prismaMock.wallet.findFirst.mockResolvedValue(null);
    const body = clientBody();
    body.actions = [{ type: 'pay_minimum', obligationId: 'card-999', amount: 620 }];
    const response = await post(body);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('NOT_OWNER');
    expect(prismaMock.wallet.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 999, user_id: 1, house_id: null } }),
    );
    expect(applyCashPlan).not.toHaveBeenCalled();
  });

  it("another owner's expense → 400", async () => {
    prismaMock.expense.findFirst.mockResolvedValue(null);
    const body = clientBody();
    body.actions = [{ type: 'defer_nonessential', obligationId: 'bill-555', amount: 300 }];
    const response = await post(body);
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('NOT_OWNER');
    expect(applyCashPlan).not.toHaveBeenCalled();
  });

  it('a route id that is not in the recomputed plan → 409', async () => {
    const response = await post({ ...clientBody(), routeId: 'no-such-route' });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('PLAN_MISMATCH');
    expect(applyCashPlan).not.toHaveBeenCalled();
  });

  it('an action list that differs from the recomputed route → 409', async () => {
    const body = clientBody();
    body.actions = body.actions.map((step, index) => (index === 0 ? { ...step, amount: (step.amount ?? 0) + 1 } : step));
    const response = await post(body);
    expect(response.status).toBe(409);
    expect(applyCashPlan).not.toHaveBeenCalled();
  });

  it('a malformed body → 400', async () => {
    const response = await post({ horizon: 'semana', monthKey: 'x', routeId: '', actions: [] });
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('INVALID_BODY');
  });
});
