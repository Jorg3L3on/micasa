import { describe, expect, it } from 'vitest';
import { buildLiquidityFinancialBrief } from '@/lib/finance/liquidity-financial-brief';
import { buildLiquidityYtdContext } from '@/lib/finance/liquidity-ytd-context';
import type { LiquidityProjectionResponse } from '@/types/catalog';

const baseData = (overrides: Partial<LiquidityProjectionResponse> = {}): LiquidityProjectionResponse => ({
  as_of: '2026-05-15',
  until: '2027-06-30',
  funding_wallets: [],
  milestones: [],
  summary: {
    total_obligations_due_on_or_before_until: 0,
    funding_total: 25000,
    expected_income_total_on_or_before_until: 0,
    net_liquidity_versus_obligations: 25000,
    shortfall_versus_funding: 0,
    first_cumulative_shortfall_date: null,
    net_liquidity_versus_obligations_including_income: 25000,
    shortfall_versus_funding_and_income: 0,
    first_projected_shortfall_date: null,
  },
  assumptions: [],
  options: {
    stress_cycle_percent: 0,
    include_unpaid_expenses: false,
    include_expense_templates: false,
  },
  monthly_series: [
    {
      month_key: '2026-05',
      msi_debt_total: 0,
      installment_payment_total: 0,
      loan_payment_total: 0,
      expected_income_total: 30000,
      expense_template_total: 0,
      other_debt_components_total: 0,
      total_payments_due: 12000,
      remaining_payments_from_month: 0,
      monthly_remaining: 18000,
      outstanding_debt_total: 120000,
      debt_items: [{ id: '1', kind: 'loan', title: 'Test', subtitle: '', amount: 120000, payment_amount: 12000 }],
    },
    {
      month_key: '2026-08',
      msi_debt_total: 0,
      installment_payment_total: 0,
      loan_payment_total: 0,
      expected_income_total: 30000,
      expense_template_total: 0,
      other_debt_components_total: 0,
      total_payments_due: 22000,
      remaining_payments_from_month: 0,
      monthly_remaining: -4000,
      outstanding_debt_total: 95000,
      debt_items: [{ id: '2', kind: 'loan', title: 'Test', subtitle: '', amount: 95000, payment_amount: 22000 }],
    },
    {
      month_key: '2026-12',
      msi_debt_total: 0,
      installment_payment_total: 0,
      loan_payment_total: 0,
      expected_income_total: 30000,
      expense_template_total: 0,
      other_debt_components_total: 0,
      total_payments_due: 8000,
      remaining_payments_from_month: 0,
      monthly_remaining: 22000,
      outstanding_debt_total: 80000,
      debt_items: [{ id: '3', kind: 'loan', title: 'Test', subtitle: '', amount: 80000, payment_amount: 8000 }],
    },
    {
      month_key: '2027-06',
      msi_debt_total: 0,
      installment_payment_total: 0,
      loan_payment_total: 0,
      expected_income_total: 30000,
      expense_template_total: 0,
      other_debt_components_total: 0,
      total_payments_due: 5000,
      remaining_payments_from_month: 0,
      monthly_remaining: 25000,
      outstanding_debt_total: 40000,
      debt_items: [{ id: '4', kind: 'loan', title: 'Test', subtitle: '', amount: 40000, payment_amount: 5000 }],
    },
  ],
  projection_events: [{ event_type: 'loan_payoff', event_date: '2026-11-01', month_key: '2026-11', title: 'Fin', subtitle: '' }],
  projection_tracks: [],
  card_utilization_summary: { cards: [], dangerous_count: 0, unrated_count: 0 },
  ...overrides,
});

describe('buildLiquidityFinancialBrief', () => {
  it('builds rest-of-year vs next-year payment metrics', () => {
    const brief = buildLiquidityFinancialBrief(baseData());
    expect(brief.metrics.some((metric) => metric.label.includes('resto 2026'))).toBe(true);
    expect(brief.metrics.some((metric) => metric.label.includes('2027'))).toBe(true);
    expect(brief.compareLine).toContain('Resto 2026');
    expect(brief.compareLine).toContain('2027');
  });

  it('flags critical tone when a future month is tight', () => {
    const brief = buildLiquidityFinancialBrief(baseData());
    expect(brief.tone).toBe('critical');
    expect(brief.headline).toContain('Presión');
    expect(brief.insights[0]).toContain('Mes más apretado');
  });

  it('uses positive tone when debt falls and no tight months', () => {
    const brief = buildLiquidityFinancialBrief(
      baseData({
        summary: {
          ...baseData().summary,
          funding_total: 150000,
        },
        monthly_series: baseData().monthly_series.map((month) => ({
          ...month,
          monthly_remaining: 5000,
        })),
      }),
    );
    expect(brief.tone).toBe('positive');
    expect(brief.insights.some((line) => line.includes('Adeudo al cierre'))).toBe(true);
  });

  it('suggests action for the tightest payment month', () => {
    const brief = buildLiquidityFinancialBrief(baseData());
    expect(brief.actionNow).toContain('Anticipa');
    expect(brief.actionNow).toContain('Agosto');
  });

  it('prioritizes dangerous card guidance over generic advice', () => {
    const brief = buildLiquidityFinancialBrief(
      baseData({
        summary: {
          ...baseData().summary,
          funding_total: 150000,
        },
        monthly_series: baseData().monthly_series.map((month) => ({
          ...month,
          monthly_remaining: 5000,
        })),
        card_utilization_summary: {
          cards: [
            {
              card_id: 1,
              card_name: 'Liverpool',
              card_type: 'DEPARTMENT_STORE_CARD',
              used_amount: 9000,
              credit_limit: 10000,
              utilization_percent: 90,
              risk_level: 'danger',
              is_danger: true,
            },
          ],
          dangerous_count: 1,
          unrated_count: 0,
        },
      }),
    );

    expect(brief.actionNow).toContain('Liverpool');
  });

  it('passes through YTD context', () => {
    const ytd = buildLiquidityYtdContext({
      asOfYmd: '2026-05-15',
      monthlySummary: [{ year: 2026, month: 5, expense: 1000 }],
      totalSpentYtd: 5000,
    });
    const brief = buildLiquidityFinancialBrief(baseData(), ytd);
    expect(brief.ytd?.spentYtd).toBe(5000);
    expect(brief.ytd?.debtPaidYtd).toBe(1000);
  });
});
