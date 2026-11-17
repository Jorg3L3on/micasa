import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainError } from '@/lib/finance/domain-error';

const { getOwnerContext, upsertCreditCardPaymentPlan } = vi.hoisted(() => ({
  getOwnerContext: vi.fn(),
  upsertCreditCardPaymentPlan: vi.fn(),
}));

vi.mock('@/lib/server/get-owner-context', () => ({
  getOwnerContext,
}));

vi.mock('@/lib/finance/credit-card-payment-plan.service', () => ({
  upsertCreditCardPaymentPlan,
  clearCreditCardPaymentPlan: vi.fn(),
}));

import { PUT } from './route';

const ownerContext = {
  userId: 1,
  ownerType: 'user' as const,
  ownerId: 1,
  ownerFilter: { user_id: 1, house_id: null },
  role: 'owner' as const,
};

const savedPlan = (plannedAmount: number, overDebtReason: string | null = null) => ({
  credit_card_wallet_id: 1,
  fortnight_id: 1,
  planned_amount: plannedAmount,
  declared_zero: false,
  scope: 'THIS_CYCLE',
  cycle_count: null,
  valid_until: null,
  over_debt_reason: overDebtReason,
});

const putPlan = (body: unknown) =>
  PUT(
    new Request('http://localhost/api/fortnights/1/card-payment-plans', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as Parameters<typeof PUT>[0],
    { params: Promise.resolve({ id: '1' }) },
  );

describe('PUT /api/fortnights/[id]/card-payment-plans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerContext.mockResolvedValue(ownerContext);
  });

  it('maps a missing over-debt reason to 400 OVER_DEBT_REASON_REQUIRED', async () => {
    upsertCreditCardPaymentPlan.mockRejectedValue(
      new DomainError(
        'OVER_DEBT_REASON_REQUIRED',
        'El monto planeado supera la deuda registrada. Indica el motivo del cargo del banco.',
        400,
      ),
    );

    const response = await putPlan({ walletId: 1, plannedAmount: 1000 });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('OVER_DEBT_REASON_REQUIRED');
    expect(upsertCreditCardPaymentPlan).toHaveBeenCalledWith(
      ownerContext.ownerFilter,
      1,
      1,
      1000,
      expect.objectContaining({ overDebtReason: undefined }),
    );
  });

  it('accepts over_debt_reason and returns the OVER_DEBT warning with the excess', async () => {
    upsertCreditCardPaymentPlan.mockResolvedValue({
      ...savedPlan(1000, 'INTEREST'),
      warning: 'OVER_DEBT',
      excess: 850,
    });

    const response = await putPlan({
      walletId: 1,
      plannedAmount: 1000,
      over_debt_reason: 'INTEREST',
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      plannedAmount: 1000,
      warning: 'OVER_DEBT',
      excess: 850,
    });
    expect(upsertCreditCardPaymentPlan).toHaveBeenCalledWith(
      ownerContext.ownerFilter,
      1,
      1,
      1000,
      expect.objectContaining({ overDebtReason: 'INTEREST' }),
    );
  });

  it('keeps the previous response when the plan is at or below the debt', async () => {
    upsertCreditCardPaymentPlan.mockResolvedValue(savedPlan(150));

    const response = await putPlan({ walletId: 1, plannedAmount: 150 });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      walletId: 1,
      fortnightId: 1,
      plannedAmount: 150,
      declaredZero: false,
      scope: 'THIS_CYCLE',
      cycleCount: null,
      validUntil: null,
    });
    expect(body).not.toHaveProperty('warning');
    expect(body).not.toHaveProperty('excess');
  });
});
