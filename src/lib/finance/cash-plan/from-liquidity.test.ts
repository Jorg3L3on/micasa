import { describe, expect, it } from 'vitest';
import { classifyObligationLabel, planInputFromLiquidity } from '@/lib/finance/cash-plan/from-liquidity';
import { buildCashPlan } from '@/lib/finance/cash-plan/build-cash-plan';
import type { LiquidityProjectionResponse } from '@/types/catalog';

const projection = (): LiquidityProjectionResponse => ({
  as_of: '2026-09-10',
  until: '2027-03-10',
  funding_wallets: [{ id: 1, name: 'Efectivo sintético', type: 'CASH', balance: 1000 }],
  milestones: [
    {
      due_date: '2026-09-10',
      is_past_due: false,
      obligations: [
        {
          source: 'credit_card_statement',
          wallet_id: 7,
          wallet_name: 'Tarjeta A',
          wallet_type: 'CREDIT_CARD',
          statement_start: '2026-08-15',
          statement_end: '2026-09-14',
          statement_due_date: '2026-09-10',
          last_statement_balance: 1200,
          payments_applied_to_statement: 0,
          next_due_payment: 1200,
        },
        {
          source: 'expense_template',
          wallet_id: 0,
          wallet_name: 'Renta',
          wallet_type: 'CASH',
          statement_start: '2026-09-01',
          statement_end: '2026-09-30',
          statement_due_date: '2026-09-10',
          last_statement_balance: 0,
          payments_applied_to_statement: 0,
          next_due_payment: 3000,
          expense_template_id: 4,
          template_name: 'Renta',
        },
      ],
      total_due: 4200,
      cumulative_due_through_date: 4200,
      funding_total: 1000,
      liquidity_headroom: -3200,
    },
    {
      due_date: '2026-09-20',
      is_past_due: false,
      obligations: [
        {
          source: 'expense_template',
          wallet_id: 0,
          wallet_name: 'Netflix',
          wallet_type: 'CASH',
          statement_start: '2026-09-01',
          statement_end: '2026-09-30',
          statement_due_date: '2026-09-20',
          last_statement_balance: 0,
          payments_applied_to_statement: 0,
          next_due_payment: 200,
          expense_template_id: 9,
          template_name: 'Netflix',
        },
      ],
      total_due: 200,
      cumulative_due_through_date: 4400,
      funding_total: 1000,
      liquidity_headroom: -3400,
    },
  ],
  summary: {
    total_obligations_due_on_or_before_until: 4400,
    funding_total: 1000,
    expected_income_total_on_or_before_until: 2000,
    net_liquidity_versus_obligations: -3400,
    shortfall_versus_funding: 3400,
    first_cumulative_shortfall_date: '2026-09-10',
    net_liquidity_versus_obligations_including_income: -1400,
    shortfall_versus_funding_and_income: 1400,
    first_projected_shortfall_date: '2026-09-10',
  },
  assumptions: [],
  options: {
    stress_cycle_percent: 0,
    include_unpaid_expenses: true,
    include_expense_templates: true,
  },
  monthly_series: [
    {
      month_key: '2026-09',
      msi_debt_total: 1200,
      installment_payment_total: 400,
      loan_payment_total: 0,
      expected_income_total: 2000,
      expense_template_total: 3200,
      other_debt_components_total: 0,
      total_payments_due: 4800,
      remaining_payments_from_month: 4800,
      monthly_remaining: -2800,
      outstanding_debt_total: 8000,
      debt_items: [
        {
          id: 'msi-1-2026-09',
          kind: 'msi',
          title: 'Plan MSI sintético',
          subtitle: 'Tarjeta A',
          amount: 8000,
          payment_amount: 400,
        },
      ],
    },
  ],
  projection_events: [],
  projection_tracks: [],
  card_utilization_summary: {
    cards: [
      {
        card_id: 7,
        card_name: 'Tarjeta A',
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
});

describe('planInputFromLiquidity', () => {
  it('classifies tier-1 labels and leaves subscriptions discretionary', () => {
    expect(classifyObligationLabel('Renta').tier).toBe(1);
    expect(classifyObligationLabel('Servicios del hogar').tier).toBe(1);
    expect(classifyObligationLabel('Servicios y suscripciones').discretionary).toBe(true);
    expect(classifyObligationLabel('Gasolina').tier).toBe(2);
    expect(classifyObligationLabel('Nómina · Casa', { payroll: true }).tier).toBe(1);
  });

  it('uses the MSI installment, not the remaining balance, for the month', () => {
    const input = planInputFromLiquidity({
      projection: projection(),
      monthKey: '2026-09',
      horizon: 'mes',
      asOfYmd: '2026-09-10',
      computedAt: '2026-09-10T00:00:00.000Z',
    });
    const msi = input.obligations.find((obligation) => obligation.kind === 'card_msi');
    expect(msi?.msiInstallment).toBe(400);
    expect(msi?.balanceTotal).toBe(8000);
    expect(msi?.statementDue).toBeUndefined();
    const rent = input.obligations.find((obligation) => obligation.id.startsWith('bill-'));
    expect(rent?.consequenceTier).toBe(1);
    expect(input.untouchableIds).toContain(rent?.id);
    const result = buildCashPlan(input);
    const amounts = [result.primary, ...result.alternatives].flatMap((plan) =>
      plan.actions.map((item) => item.amount),
    );
    expect(amounts).not.toContain(8000);
    expect(input.gapAmount).toBeCloseTo((4800 - 2000 - 1000) / 1, 2);
  });

  it('keeps a quincena to dated obligations and does not split income', () => {
    const input = planInputFromLiquidity({
      projection: projection(),
      monthKey: '2026-09',
      horizon: 'quincena',
      asOfYmd: '2026-09-10',
      computedAt: '2026-09-10T00:00:00.000Z',
    });
    expect(input.dataGaps?.map((gap) => gap.code)).toContain('income_monthly_only');
    expect(input.dataGaps?.map((gap) => gap.code)).toContain('undated_obligation');
    expect(input.obligations.some((obligation) => obligation.kind === 'card_msi')).toBe(false);
    expect(input.obligations.some((obligation) => obligation.labelSynthetic === 'Netflix')).toBe(false);
    expect(input.obligations.some((obligation) => obligation.labelSynthetic === 'Renta')).toBe(false);
    expect(input.obligations.some((obligation) => obligation.labelSynthetic === 'Tarjeta A')).toBe(true);
    const summed = input.gapLines.reduce((sum, line) => sum + line.amount, 0);
    expect(summed).toBeCloseTo(input.gapAmount, 2);
  });

  it('drops a plantilla and a card already paid this fortnight from the quincena hueco', () => {
    const source = projection();
    const card = source.milestones[0]?.obligations[0];
    if (card && card.source === 'credit_card_statement') {
      card.planner_status = 'pagado';
      card.planned_fortnight_payment = 100;
      card.payments_applied_to_fortnight = 100;
      card.remaining_planner_amount = 0;
    }
    source.milestones[0]?.obligations.push({
      source: 'unpaid_expense',
      wallet_id: 1,
      wallet_name: 'Efectivo sintético',
      wallet_type: 'CASH',
      statement_start: '',
      statement_end: '',
      statement_due_date: '2026-09-10',
      last_statement_balance: 0,
      payments_applied_to_statement: 0,
      next_due_payment: 250,
      expense_id: 9,
      expense_description: 'Transporte',
    });
    const input = planInputFromLiquidity({
      projection: source,
      monthKey: '2026-09',
      horizon: 'quincena',
      asOfYmd: '2026-09-10',
      computedAt: '2026-09-10T00:00:00.000Z',
    });
    expect(input.obligations.map((obligation) => obligation.labelSynthetic)).toEqual(['Transporte']);
    expect(input.gapAmount).toBeCloseTo(250 - 1000, 2);
    expect(input.gapLines.map((line) => line.label)).toEqual(['Transporte', 'Efectivo disponible']);
  });

  it('maps a real card minimum into pay_minimum and does not copy a loan installment', () => {
    const source = projection();
    const card = source.milestones[0]?.obligations[0];
    if (card && card.source === 'credit_card_statement') {
      card.minimum_payment = 400;
      card.apr_annual = 0.42;
    }
    source.milestones[0]?.obligations.push({
      source: 'loan_payment',
      wallet_id: 1,
      wallet_name: 'Efectivo sintético',
      wallet_type: 'CASH',
      statement_start: '',
      statement_end: '2026-09-10',
      statement_due_date: '2026-09-10',
      last_statement_balance: 0,
      payments_applied_to_statement: 0,
      next_due_payment: 500,
      loan_id: 3,
      loan_payment_id: 8,
      loan_name: 'Préstamo A',
      lender: 'Mercado Libre',
    });
    const input = planInputFromLiquidity({
      projection: source,
      monthKey: '2026-09',
      horizon: 'mes',
      asOfYmd: '2026-09-10',
      computedAt: '2026-09-10T12:00:00.000Z',
    });
    const revolving = input.obligations.find((obligation) => obligation.id === 'card-7');
    const loan = input.obligations.find((obligation) => obligation.kind === 'loan');
    expect(revolving?.minimumDue).toBe(400);
    expect(revolving?.aprAnnual).toBe(0.42);
    expect(revolving?.catAnnual).toBeNull();
    expect(revolving?.statementDue).toBe(1200);
    expect(loan?.statementDue).toBe(500);
    expect(loan?.minimumDue).toBeUndefined();
    expect(revolving?.minimumDue).not.toBe(revolving?.statementDue);
    const fortnight = planInputFromLiquidity({
      projection: source,
      monthKey: '2026-09',
      horizon: 'quincena',
      asOfYmd: '2026-09-10',
      computedAt: '2026-09-10T12:00:00.000Z',
    });
    expect(fortnight.gapLines.find((line) => line.label === 'Préstamo A')?.group).toEqual({
      id: 'Mercado Libre',
      label: 'Mercado Libre',
    });
    expect(input.prefs?.missingAprPolicy).toBe('exclude_from_apr_rank');
    const result = buildCashPlan(input);
    const plans = [result.primary, ...result.alternatives];
    expect(plans.some((plan) => plan.actions.some((item) => item.type === 'pay_minimum'))).toBe(true);
    expect(result.primary.touchesUntouchable).toBe(false);
    expect(result.dataGaps.some((gap) => gap.message === 'No tenemos el pago mínimo de tus tarjetas.')).toBe(false);
  });

  it('leaves minimum and rates null when the projection has none', () => {
    const input = planInputFromLiquidity({
      projection: projection(),
      monthKey: '2026-09',
      horizon: 'mes',
      asOfYmd: '2026-09-10',
    });
    const revolving = input.obligations.find((obligation) => obligation.id === 'card-7');
    expect(revolving?.statementDue).toBe(1200);
    expect(revolving?.minimumDue).toBeNull();
    expect(revolving?.aprAnnual).toBeNull();
    expect(revolving?.catAnnual).toBeNull();
    expect(revolving?.minimumDue).not.toBe(1200);
  });

  it('maps CAT when the projection carries it and does not assume 36%', () => {
    const source = projection();
    const card = source.milestones[0]?.obligations[0];
    if (card && card.source === 'credit_card_statement') {
      card.cat_annual = 0.55;
    }
    const input = planInputFromLiquidity({
      projection: source,
      monthKey: '2026-09',
      horizon: 'mes',
      asOfYmd: '2026-09-10',
    });
    const revolving = input.obligations.find((obligation) => obligation.id === 'card-7');
    expect(revolving?.catAnnual).toBe(0.55);
    expect(revolving?.aprAnnual).toBeNull();
    expect(revolving?.aprAnnual).not.toBe(0.36);
  });

  it('counts an MSI installment in the fortnight when the due date falls inside it', () => {
    const source = projection();
    const month = source.monthly_series[0];
    if (month) {
      month.debt_items = [
        {
          id: 'msi-1-2026-09',
          kind: 'msi',
          title: 'Plan MSI sintético',
          subtitle: 'Tarjeta A',
          amount: 8000,
          payment_amount: 400,
          due_date: '2026-09-10',
        },
      ];
    }
    const inside = planInputFromLiquidity({
      projection: source,
      monthKey: '2026-09',
      horizon: 'quincena',
      asOfYmd: '2026-09-10',
      computedAt: '2026-09-10T12:00:00.000Z',
    });
    const msi = inside.obligations.find((obligation) => obligation.kind === 'card_msi');
    expect(msi?.msiInstallment).toBe(400);
    expect(msi?.balanceTotal).toBe(8000);
    expect(inside.dataGaps?.some((gap) => gap.code === 'undated_obligation')).toBe(false);
    expect(inside.obligations.some((obligation) => obligation.labelSynthetic === 'Netflix')).toBe(false);

    if (month) {
      month.debt_items[0] = { ...month.debt_items[0]!, due_date: '2026-09-20' };
    }
    const outside = planInputFromLiquidity({
      projection: source,
      monthKey: '2026-09',
      horizon: 'quincena',
      asOfYmd: '2026-09-10',
      computedAt: '2026-09-10T12:00:00.000Z',
    });
    expect(outside.obligations.some((obligation) => obligation.kind === 'card_msi')).toBe(false);
    expect(outside.dataGaps?.some((gap) => gap.code === 'undated_obligation')).toBe(false);
  });
});
