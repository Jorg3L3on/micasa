import { describe, expect, it } from 'vitest';
import {
  committedBarPercent,
  computeOnboardingPreview,
} from '@/components/onboarding/onboarding-preview';

const both = { appliesFirstFortnight: true, appliesSecondFortnight: true };
const firstOnly = { appliesFirstFortnight: true, appliesSecondFortnight: false };
const secondOnly = { appliesFirstFortnight: false, appliesSecondFortnight: true };

const wallets = [
  { type: 'CASH' as const, initialBalance: 800 },
  { type: 'BANK' as const, initialBalance: 12340 },
  { type: 'CREDIT' as const, initialBalance: 5000 },
];

describe('computeOnboardingPreview', () => {
  it('sums cash and debit into balance today, never credit', () => {
    const preview = computeOnboardingPreview({
      wallets,
      incomeTemplates: [],
      expenseTemplates: [],
    });
    expect(preview.balanceToday).toBe(13140);
  });

  it('with no income: nothing to compare, percent is null', () => {
    const preview = computeOnboardingPreview({
      wallets,
      incomeTemplates: [{ amount: 0, ...both }],
      expenseTemplates: [{ amount: 500, ...both }],
    });
    expect(preview.hasIncome).toBe(false);
    expect(preview.first).toEqual({
      income: 0,
      fixedCosts: 500,
      free: -500,
      percentCommitted: null,
    });
    expect(committedBarPercent(preview.first)).toBe(100);
  });

  it('items in both quincenas count in each one', () => {
    const preview = computeOnboardingPreview({
      wallets,
      incomeTemplates: [{ amount: 18500, ...both }],
      expenseTemplates: [{ amount: 2400, ...both }],
    });
    expect(preview.hasIncome).toBe(true);
    expect(preview.hasFixedCosts).toBe(true);
    expect(preview.first).toEqual({
      income: 18500,
      fixedCosts: 2400,
      free: 16100,
      percentCommitted: 13,
    });
    expect(preview.second).toEqual(preview.first);
  });

  it('first-only items count only in the 1ª quincena', () => {
    const preview = computeOnboardingPreview({
      wallets,
      incomeTemplates: [{ amount: 18500, ...both }, { amount: 1000, ...firstOnly }],
      expenseTemplates: [{ amount: 7500, ...firstOnly }],
    });
    expect(preview.first).toMatchObject({ income: 19500, fixedCosts: 7500, free: 12000 });
    expect(preview.second).toMatchObject({ income: 18500, fixedCosts: 0, free: 18500 });
    expect(preview.second.percentCommitted).toBe(0);
  });

  it('second-only items count only in the 2ª quincena (design frame numbers)', () => {
    const preview = computeOnboardingPreview({
      wallets,
      incomeTemplates: [{ amount: 18500, ...both }],
      expenseTemplates: [
        { amount: 7500, ...firstOnly },
        { amount: 2400, ...both },
        { amount: 599, ...secondOnly },
        { amount: 450, ...secondOnly },
      ],
    });
    expect(preview.first).toEqual({
      income: 18500,
      fixedCosts: 9900,
      free: 8600,
      percentCommitted: 54,
    });
    expect(preview.second).toEqual({
      income: 18500,
      fixedCosts: 3449,
      free: 15051,
      percentCommitted: 19,
    });
  });

  it('expenses above income leave a negative free amount and pass 100%', () => {
    const preview = computeOnboardingPreview({
      wallets,
      incomeTemplates: [{ amount: 5000, ...both }],
      expenseTemplates: [{ amount: 7500, ...firstOnly }],
    });
    expect(preview.first.free).toBe(-2500);
    expect(preview.first.percentCommitted).toBe(150);
    expect(committedBarPercent(preview.first)).toBe(100);
  });

  it('drafts without an amount count as 0', () => {
    const preview = computeOnboardingPreview({
      wallets: [
        { type: 'CASH', initialBalance: Number.NaN },
        { type: 'BANK', initialBalance: 100 },
      ],
      incomeTemplates: [
        { amount: 1000, ...both },
        { amount: Number.NaN, ...both },
      ],
      expenseTemplates: [
        { amount: 0, ...both },
        { amount: Number.POSITIVE_INFINITY, ...firstOnly },
      ],
    });
    expect(preview.balanceToday).toBe(100);
    expect(preview.hasFixedCosts).toBe(false);
    expect(preview.first).toEqual({
      income: 1000,
      fixedCosts: 0,
      free: 1000,
      percentCommitted: 0,
    });
  });

  it('rounds float sums to cents', () => {
    const preview = computeOnboardingPreview({
      wallets: [
        { type: 'CASH', initialBalance: 0.1 },
        { type: 'BANK', initialBalance: 0.2 },
      ],
      incomeTemplates: [{ amount: 0.3, ...both }],
      expenseTemplates: [{ amount: 0.1, ...both }, { amount: 0.2, ...both }],
    });
    expect(preview.balanceToday).toBe(0.3);
    expect(preview.first.free).toBe(0);
  });
});
