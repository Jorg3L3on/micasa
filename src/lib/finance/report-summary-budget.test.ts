import { describe, expect, it } from 'vitest';
import { fundingLiquidity, planningBalance } from './report-summary.service';

/**
 * Liquidez actual and Tras pagar subtract the quincena budget reserve
 * (`planningBudgetRemaining` from the budget panel). Pausing a budget for the
 * quincena (MIC-I19) drops its reserve to 0, so both rise by exactly that.
 */
describe('report summary · budget reserve', () => {
  const base = { totalIncome: 24000, payrollDeduction: 0, totalExpense: 16000 };
  const funds = { fundingWalletBalanceTotal: 18450, totalUnpaid: 6200, payrollDeduction: 0 };

  it('rises by exactly the template reserve when the budget is paused', () => {
    const before = { balance: planningBalance({ ...base, budgetRemaining: 2600 }), liquidity: fundingLiquidity({ ...funds, budgetRemaining: 2600 }) };
    const after = { balance: planningBalance({ ...base, budgetRemaining: 0 }), liquidity: fundingLiquidity({ ...funds, budgetRemaining: 0 }) };
    expect(before.liquidity).toBe(9650);
    expect(after.liquidity - before.liquidity).toBe(2600);
    expect(after.balance - before.balance).toBe(2600);
  });
});
