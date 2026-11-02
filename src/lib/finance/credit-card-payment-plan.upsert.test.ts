import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardBankChargeReason } from '@/generated/prisma/client';
import { DomainError } from '@/lib/finance/domain-error';

const { findFirstFortnight, findFirstWallet, upsertPlan } = vi.hoisted(() => ({
  findFirstFortnight: vi.fn(),
  findFirstWallet: vi.fn(),
  upsertPlan: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    fortnight: { findFirst: findFirstFortnight },
    wallet: { findFirst: findFirstWallet },
    creditCardPaymentPlan: { upsert: upsertPlan },
  },
}));

import { upsertCreditCardPaymentPlan } from '@/lib/finance/credit-card-payment-plan.service';

const ownerFilter = { user_id: 1, house_id: null } as const;

const creditCard = (amount: number) => ({
  id: 1,
  type: 'CREDIT_CARD',
  amount,
  cutoff_day: null,
  due_day: null,
});

describe('upsertCreditCardPaymentPlan over recorded debt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findFirstFortnight.mockResolvedValue({ id: 1, year: 2026, month: 10 });
    upsertPlan.mockImplementation(
      async ({
        create,
      }: {
        create: { planned_amount: number; over_debt_reason: string | null };
      }) => ({
        credit_card_wallet_id: 1,
        fortnight_id: 1,
        planned_amount: create.planned_amount,
        declared_zero: false,
        scope: 'THIS_CYCLE',
        cycle_count: null,
        valid_until: null,
        over_debt_reason: create.over_debt_reason,
      }),
    );
  });

  it('returns 400 OVER_DEBT_REASON_REQUIRED when the plan is above the debt and has no reason', async () => {
    findFirstWallet.mockResolvedValue(creditCard(150));

    const error = await upsertCreditCardPaymentPlan(
      ownerFilter,
      1,
      1,
      1000,
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toMatchObject({
      code: 'OVER_DEBT_REASON_REQUIRED',
      status: 400,
    });
    expect(upsertPlan).not.toHaveBeenCalled();
  });

  it('saves the plan and returns an OVER_DEBT warning with the excess when a reason is given', async () => {
    findFirstWallet.mockResolvedValue(creditCard(150));

    const plan = await upsertCreditCardPaymentPlan(ownerFilter, 1, 1, 1000, {
      overDebtReason: CardBankChargeReason.INTEREST,
    });

    expect(plan.warning).toBe('OVER_DEBT');
    expect(plan.excess).toBe(850);
    expect(upsertPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          planned_amount: 1000,
          over_debt_reason: 'INTEREST',
        }),
        update: expect.objectContaining({
          planned_amount: 1000,
          over_debt_reason: 'INTEREST',
        }),
      }),
    );
  });

  it('leaves a plan at the recorded debt unchanged', async () => {
    findFirstWallet.mockResolvedValue(creditCard(1000));

    const plan = await upsertCreditCardPaymentPlan(ownerFilter, 1, 1, 1000);

    expect(plan).not.toHaveProperty('warning');
    expect(plan).not.toHaveProperty('excess');
    expect(plan.planned_amount).toBe(1000);
    expect(upsertPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          planned_amount: 1000,
          over_debt_reason: null,
        }),
        update: expect.objectContaining({
          planned_amount: 1000,
          over_debt_reason: null,
        }),
      }),
    );
  });

  it('leaves a plan below the recorded debt unchanged', async () => {
    findFirstWallet.mockResolvedValue(creditCard(1000));

    const plan = await upsertCreditCardPaymentPlan(ownerFilter, 1, 1, 150, {
      overDebtReason: CardBankChargeReason.LATE_FEE,
    });

    expect(plan).not.toHaveProperty('warning');
    expect(plan).not.toHaveProperty('excess');
    expect(plan.planned_amount).toBe(150);
    expect(upsertPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          planned_amount: 150,
          over_debt_reason: null,
        }),
        update: expect.objectContaining({
          planned_amount: 150,
          over_debt_reason: null,
        }),
      }),
    );
  });
});
