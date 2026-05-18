import { describe, expect, it } from 'vitest';
import { liquidityProjectionToCsv } from '@/lib/finance/liquidity-projection-csv';
import type { LiquidityProjectionResult } from '@/lib/finance/liquidity-projection.service';

const minimalResult = (): LiquidityProjectionResult => ({
  as_of: '2026-03-10',
  until: '2026-06-30',
  funding_wallets: [{ id: 1, name: 'Cash', type: 'CASH', balance: 100 }],
  milestones: [
    {
      due_date: '2026-03-20',
      is_past_due: false,
      total_due: 50,
      cumulative_due_through_date: 50,
      funding_total: 100,
      liquidity_headroom: 50,
      obligations: [
        {
          source: 'credit_card_statement',
          wallet_id: 7,
          wallet_name: 'Visa "Plus"',
          wallet_type: 'CREDIT_CARD',
          statement_start: '2026-01-16',
          statement_end: '2026-02-15',
          statement_due_date: '2026-03-20',
          last_statement_balance: 50,
          payments_applied_to_statement: 0,
          next_due_payment: 50,
        },
      ],
    },
  ],
  summary: {
    total_obligations_due_on_or_before_until: 50,
    funding_total: 100,
    expected_income_total_on_or_before_until: 100,
    net_liquidity_versus_obligations: 50,
    shortfall_versus_funding: 0,
    first_cumulative_shortfall_date: null,
    net_liquidity_versus_obligations_including_income: 150,
    shortfall_versus_funding_and_income: 0,
    first_projected_shortfall_date: null,
  },
  assumptions: ['a'],
  options: {
    stress_cycle_percent: 0,
    include_unpaid_expenses: true,
    include_expense_templates: false,
  },
  monthly_series: [
    {
      month_key: '2026-03',
      msi_debt_total: 50,
      loan_payment_total: 0,
      expected_income_total: 100,
      expense_template_total: 0,
      other_debt_components_total: 0,
      monthly_remaining: 50,
    },
  ],
  card_utilization_summary: {
    cards: [],
    dangerous_count: 0,
    unrated_count: 0,
  },
});

describe('liquidityProjectionToCsv', () => {
  it('writes header and obligation rows', () => {
    const csv = liquidityProjectionToCsv(minimalResult());
    expect(csv).toContain(
      'due_date,source,wallet_id,wallet_name,amount,statement_start,statement_end,expense_id,template_id,loan_payment_id,loan_name,is_estimate,stress_adjustment',
    );
    expect(csv).toContain('2026-03-20');
    expect(csv).toContain('credit_card_statement');
    expect(csv).toContain('7');
    expect(csv).toContain('summary,funding_total,100,obligations_total,50,shortfall,0');
  });

  it('escapes quotes and commas in wallet_name', () => {
    const csv = liquidityProjectionToCsv(minimalResult());
    expect(csv).toMatch(/""Plus""/);
  });

  it('includes stress_adjustment and estimate flags', () => {
    const data = minimalResult();
    data.milestones[0]!.obligations.push({
      source: 'expense_template',
      wallet_id: 1,
      wallet_name: 'Cash',
      wallet_type: 'CASH',
      statement_start: '2026-03-01',
      statement_end: '2026-03-15',
      statement_due_date: '2026-03-15',
      last_statement_balance: 0,
      payments_applied_to_statement: 0,
      next_due_payment: 25,
      expense_template_id: 9,
      template_name: 'Rent',
      is_estimate: true,
      stress_adjustment: 10,
    });
    const csv = liquidityProjectionToCsv(data);
    expect(csv).toContain('expense_template');
    expect(csv).toContain('true');
    expect(csv).toContain('10');
  });
});
