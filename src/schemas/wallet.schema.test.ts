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
