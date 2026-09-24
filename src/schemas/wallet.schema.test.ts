import { describe, expect, it } from 'vitest';
import {
  createWalletSchema,
  walletSchema,
} from '@/schemas/wallet.schema';

describe('walletSchema GOAL', () => {
  it('requires goal_amount and goal_due_date for GOAL', () => {
    const result = walletSchema.safeParse({
      name: 'Viaje',
      type: 'GOAL',
      amount: 0,
      include_in_liquidity: false,
      cutoff_day: null,
      due_day: null,
      goal_amount: null,
      goal_due_date: null,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a valid GOAL (liquidity forced off in service)', () => {
    const parsed = createWalletSchema.parse({
      name: 'Auto',
      type: 'GOAL',
      amount: 100,
      include_in_liquidity: true,
      cutoff_day: null,
      due_day: null,
      goal_amount: 450000,
      goal_due_date: '2029-10-30',
    });
    expect(parsed.goal_amount).toBe(450000);
    expect(parsed.type).toBe('GOAL');
  });

  it('accepts a card without minimum or rates', () => {
    const parsed = createWalletSchema.parse({
      name: 'Tarjeta A',
      type: 'CREDIT_CARD',
      amount: 0,
      credit_limit: 10000,
      cutoff_day: 15,
      due_day: 5,
    });
    expect(parsed.minimum_payment ?? null).toBeNull();
    expect(parsed.apr_annual ?? null).toBeNull();
    expect(parsed.cat_annual ?? null).toBeNull();
  });

  it('maps captured minimum and annual rates without inventing defaults', () => {
    const parsed = createWalletSchema.parse({
      name: 'Tarjeta A',
      type: 'CREDIT_CARD',
      amount: 0,
      credit_limit: 10000,
      cutoff_day: 15,
      due_day: 5,
      minimum_payment: 400,
      apr_annual: 0.42,
      cat_annual: 0.55,
    });
    expect(parsed.minimum_payment).toBe(400);
    expect(parsed.apr_annual).toBe(0.42);
    expect(parsed.cat_annual).toBe(0.55);
    expect(parsed.apr_annual).not.toBe(0.36);
  });

  it('rejects minimum and rates on a funding wallet', () => {
    const result = createWalletSchema.safeParse({
      name: 'Efectivo',
      type: 'CASH',
      amount: 100,
      cutoff_day: null,
      due_day: null,
      minimum_payment: 400,
      apr_annual: 0.42,
    });
    expect(result.success).toBe(false);
  });

  it('rejects goal fields on funding wallets', () => {
    const result = walletSchema.safeParse({
      name: 'Efectivo',
      type: 'CASH',
      amount: 10,
      include_in_liquidity: true,
      cutoff_day: null,
      due_day: null,
      goal_amount: 100,
      goal_due_date: '2026-12-01',
    });
    expect(result.success).toBe(false);
  });
});
