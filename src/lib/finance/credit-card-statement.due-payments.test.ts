import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  queryRaw,
  findManyWallets,
  findManyStatementImports,
  findManyExpenses,
  findFirstFortnight,
  findManyPaymentPlans,
  findManyScheduledPayments,
  findManyInstallmentPlanPayments,
} = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findManyWallets: vi.fn(),
  findManyStatementImports: vi.fn(),
  findManyExpenses: vi.fn(),
  findFirstFortnight: vi.fn(),
  findManyPaymentPlans: vi.fn(),
  findManyScheduledPayments: vi.fn(),
  findManyInstallmentPlanPayments: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $queryRaw: queryRaw,
    wallet: {
      findMany: findManyWallets,
    },
    creditCardStatementImport: {
      findMany: findManyStatementImports,
    },
    expense: {
      findMany: findManyExpenses,
    },
    fortnight: {
      findFirst: findFirstFortnight,
    },
    creditCardPaymentPlan: {
      findMany: findManyPaymentPlans,
    },
    creditCardScheduledPayment: {
      findMany: findManyScheduledPayments,
    },
    creditCardInstallmentPlanPayment: {
      findMany: findManyInstallmentPlanPayments,
    },
  },
}));

import {
  getDuePaymentsForCurrentFortnight,
  getDuePaymentsForPlannerMonth,
} from '@/lib/finance/credit-card-statement.service';

const userOwner = { user_id: 1, house_id: null } as const;

describe('getDuePaymentsForCurrentFortnight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 20, 15, 0, 0)));
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([]);
    findManyWallets.mockReset();
    findManyStatementImports.mockReset();
    findManyStatementImports.mockResolvedValue([]);
    findManyExpenses.mockReset();
    findManyExpenses.mockResolvedValue([]);
    findFirstFortnight.mockReset();
    findFirstFortnight.mockResolvedValue({ id: 42 });
    findManyPaymentPlans.mockReset();
    findManyPaymentPlans.mockResolvedValue([]);
    findManyScheduledPayments.mockReset();
    findManyScheduledPayments.mockResolvedValue([]);
    findManyInstallmentPlanPayments.mockReset();
    findManyInstallmentPlanPayments.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns an empty list and skips SQL when there are no cards', async () => {
    findManyWallets.mockResolvedValue([]);
    const result = await getDuePaymentsForCurrentFortnight(userOwner);
    expect(result).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('uses batched aggregates and returns rows with positive next due', async () => {
    findManyWallets.mockResolvedValue([
      {
        id: 7,
        name: 'Visa',
        type: 'CREDIT_CARD',
        amount: 50,
        cutoff_day: 15,
        due_day: 18,
      },
    ]);
    queryRaw
      .mockResolvedValueOnce([{ wallet_id: 7, total: 500 }])
      .mockResolvedValueOnce([{ credit_card_wallet_id: 7, total: 100 }]);

    const result = await getDuePaymentsForCurrentFortnight(userOwner);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      walletId: 7,
      walletName: 'Visa',
      nextDuePayment: 400,
      paymentsAppliedToStatement: 100,
      dueDay: 18,
      cutoff_day: 15,
    });
    expect(typeof result[0]?.statementDueDate).toBe('string');
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it('ignores last_paid_period and still returns due when statement obligation remains', async () => {
    findManyWallets.mockResolvedValue([
      {
        id: 1,
        name: 'Visa',
        type: 'CREDIT_CARD',
        amount: 50,
        cutoff_day: 15,
        due_day: 18,
      },
    ]);
    queryRaw
      .mockResolvedValueOnce([{ wallet_id: 1, total: 500 }])
      .mockResolvedValueOnce([{ credit_card_wallet_id: 1, total: 100 }]);

    const result = await getDuePaymentsForCurrentFortnight(userOwner);

    expect(result).toHaveLength(1);
    expect(result[0]?.nextDuePayment).toBe(400);
    expect(queryRaw).toHaveBeenCalledTimes(3);
  });

  it('batches two cards that share cutoff and due into one query pair', async () => {
    findManyWallets.mockResolvedValue([
      {
        id: 1,
        name: 'A',
        type: 'CREDIT_CARD',
        amount: 10,
        cutoff_day: 15,
        due_day: 18,
      },
      {
        id: 2,
        name: 'B',
        type: 'CREDIT_CARD',
        amount: 10,
        cutoff_day: 15,
        due_day: 18,
      },
    ]);
    queryRaw
      .mockResolvedValueOnce([
        { wallet_id: 1, total: 100 },
        { wallet_id: 2, total: 200 },
      ])
      .mockResolvedValueOnce([
        { credit_card_wallet_id: 1, total: 50 },
        { credit_card_wallet_id: 2, total: 0 },
      ]);

    const result = await getDuePaymentsForCurrentFortnight(userOwner);

    expect(queryRaw).toHaveBeenCalledTimes(3);
    expect(result.map((r) => r.walletId).sort()).toEqual([1, 2]);
    expect(result.find((r) => r.walletId === 1)?.nextDuePayment).toBe(50);
    expect(result.find((r) => r.walletId === 2)?.nextDuePayment).toBe(200);
  });

  it('prefers newer statement import total_due over an older same-window import (card screen parity)', async () => {
    findManyWallets.mockResolvedValue([
      {
        id: 99,
        name: 'Mercado Pago',
        type: 'CREDIT_CARD',
        amount: 4494.74,
        cutoff_day: 7,
        due_day: 17,
      },
    ]);
    findManyStatementImports.mockResolvedValue([
      {
        wallet_id: 99,
        total_due: 3941.76,
        period_end: new Date(Date.UTC(2026, 2, 7)),
        created_at: new Date(Date.UTC(2026, 2, 10, 12, 0, 0)),
      },
      {
        wallet_id: 99,
        total_due: 4494.74,
        period_end: new Date(Date.UTC(2026, 2, 7)),
        created_at: new Date(Date.UTC(2026, 2, 15, 12, 0, 0)),
      },
    ]);
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await getDuePaymentsForCurrentFortnight(userOwner);

    expect(result).toHaveLength(1);
    expect(result[0]?.nextDuePayment).toBe(4494.74);
  });

  it('uses fortnight payments for planner status on custom plans', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 31, 15, 0, 0)));
    findManyWallets.mockResolvedValue([
      {
        id: 31,
        name: 'Liverpool Carmen',
        type: 'DEPARTMENT_STORE_CARD',
        amount: 3884.78,
        cutoff_day: 6,
        due_day: 5,
      },
    ]);
    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ credit_card_wallet_id: 31, total: 694.76 }])
      .mockResolvedValueOnce([]);
    findFirstFortnight
      .mockResolvedValueOnce({ id: 35 })
      .mockResolvedValueOnce({ id: 36 });
    findManyPaymentPlans
      .mockResolvedValueOnce([
        {
          credit_card_wallet_id: 31,
          planned_amount: 694.76,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getDuePaymentsForPlannerMonth(userOwner, 2026, 6);

    expect(result.first).toHaveLength(1);
    expect(result.first[0]).toMatchObject({
      walletId: 31,
      statementDueDate: '2026-06-05',
      paymentsAppliedToFortnight: 694.76,
      plannedPayment: 694.76,
      effectiveAmount: 0,
      plannerStatus: 'pagado',
    });
    expect(result.second).toEqual([]);
  });

  it('keeps same-day corte/pago due in the planner month (Liverpool Jorge)', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 8, 20, 15, 0, 0)));
    findManyWallets.mockResolvedValue([
      {
        id: 30,
        name: 'Liverpool Jorge',
        type: 'DEPARTMENT_STORE_CARD',
        amount: 5666.01,
        cutoff_day: 13,
        due_day: 13,
      },
    ]);
    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    findFirstFortnight
      .mockResolvedValueOnce({ id: 41 })
      .mockResolvedValueOnce({ id: 42 });
    findManyPaymentPlans.mockResolvedValue([]);

    const result = await getDuePaymentsForPlannerMonth(userOwner, 2026, 10);

    expect(result.first).toHaveLength(1);
    expect(result.first[0]).toMatchObject({
      walletId: 30,
      statementDueDate: '2026-10-13',
      visibleDueDate: '2026-10-13',
    });
    expect(result.second).toEqual([]);
  });

  it('keeps a fully paid planner statement visible when the card balance is zero', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 16, 15, 0, 0)));
    findManyWallets.mockResolvedValue([
      {
        id: 26,
        name: 'DIDI Card',
        type: 'CREDIT_CARD',
        amount: 0,
        cutoff_day: 3,
        due_day: 18,
      },
    ]);
    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ credit_card_wallet_id: 26, total: 2519.99 }])
      .mockResolvedValueOnce([]);
    findManyStatementImports.mockResolvedValue([
      {
        wallet_id: 26,
        total_due: 2519.99,
        period_end: null,
        payment_due_date: new Date(Date.UTC(2026, 5, 18, 12, 0, 0)),
        created_at: new Date(Date.UTC(2026, 5, 6, 12, 0, 0)),
      },
    ]);
    findManyExpenses.mockResolvedValue([]);
    findFirstFortnight
      .mockResolvedValueOnce({ id: 35 })
      .mockResolvedValueOnce({ id: 36 });
    findManyPaymentPlans.mockResolvedValue([]);

    const result = await getDuePaymentsForPlannerMonth(userOwner, 2026, 6);

    expect(result.first).toEqual([]);
    expect(result.second).toHaveLength(1);
    expect(result.second[0]).toMatchObject({
      walletId: 26,
      walletName: 'DIDI Card',
      statementDueDate: '2026-06-18',
      nextDuePayment: 0,
      paymentsAppliedToStatement: 2519.99,
      effectiveAmount: 0,
      plannerStatus: 'pagado',
    });
  });

  it('keeps Liverpool-style full pay visible when debt is zero but statement credit is zero', async () => {
    // Pay after due day: debt cleared, payment not in statement window → must NOT disappear.
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 10, 15, 0, 0)));
    findManyWallets.mockResolvedValue([
      {
        id: 31,
        name: 'Liverpool Carmen',
        type: 'DEPARTMENT_STORE_CARD',
        amount: 0,
        cutoff_day: 6,
        due_day: 5,
      },
    ]);
    // Statement purchase/payment aggregates (no statement credit for late pay).
    queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      // Planner layer fortnight payments
      .mockResolvedValueOnce([{ credit_card_wallet_id: 31, total: 3190.02 }])
      .mockResolvedValueOnce([]);
    findManyStatementImports.mockResolvedValue([]);
    findManyExpenses.mockResolvedValue([]);
    findFirstFortnight
      .mockResolvedValueOnce({ id: 35 })
      .mockResolvedValueOnce({ id: 36 });
    findManyPaymentPlans.mockResolvedValue([]);

    const result = await getDuePaymentsForPlannerMonth(userOwner, 2026, 6);

    expect(result.first).toHaveLength(1);
    expect(result.first[0]).toMatchObject({
      walletId: 31,
      outstandingBalance: 0,
      nextDuePayment: 0,
      paymentsAppliedToStatement: 0,
      paymentsAppliedToFortnight: 3190.02,
      plannerStatus: 'pagado',
    });
    expect(result.second).toEqual([]);
  });

  it('zeros ghost import due when wallet debt is already paid off', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 24, 15, 0, 0)));
    findManyWallets.mockResolvedValue([
      {
        id: 29,
        name: 'Mercado Pago',
        type: 'CREDIT_CARD',
        amount: 0,
        cutoff_day: 7,
        due_day: 17,
      },
    ]);
    queryRaw.mockResolvedValue([]);
    findManyStatementImports.mockResolvedValue([
      {
        wallet_id: 29,
        total_due: 7646.7,
        period_end: new Date(Date.UTC(2026, 6, 7, 12, 0, 0)),
        payment_due_date: null,
        created_at: new Date(Date.UTC(2026, 6, 14, 12, 0, 0)),
      },
    ]);
    findManyExpenses.mockResolvedValue([]);
    findFirstFortnight
      .mockResolvedValueOnce({ id: 37 })
      .mockResolvedValueOnce({ id: 38 });
    findManyPaymentPlans.mockResolvedValue([]);

    const result = await getDuePaymentsForPlannerMonth(userOwner, 2026, 7);

    // Paid-off card with only a stale import and no fortnight/statement credit
    // is not planner-relevant (no ghost actionable row).
    expect(result.second).toEqual([]);
  });

  it('hides zero-balance planner cards with no statement activity', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 16, 15, 0, 0)));
    findManyWallets.mockResolvedValue([
      {
        id: 36,
        name: 'DIDI Carmen',
        type: 'CREDIT_CARD',
        amount: 0,
        cutoff_day: 12,
        due_day: 27,
      },
    ]);
    queryRaw.mockResolvedValue([]);
    findManyStatementImports.mockResolvedValue([]);
    findManyExpenses.mockResolvedValue([]);
    findFirstFortnight
      .mockResolvedValueOnce({ id: 35 })
      .mockResolvedValueOnce({ id: 36 });
    findManyPaymentPlans.mockResolvedValue([]);

    const result = await getDuePaymentsForPlannerMonth(userOwner, 2026, 6);

    expect(result.first).toEqual([]);
    expect(result.second).toEqual([]);
  });

  it('does not carry a stale import or bill total debt as this corte', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 6, 15, 0, 0)));
    findManyWallets.mockResolvedValue([
      {
        id: 101,
        name: 'Tarjeta A',
        type: 'CREDIT_CARD',
        amount: 1200,
        cutoff_day: 7,
        due_day: 17,
      },
    ]);
    queryRaw.mockResolvedValue([]);
    findManyStatementImports.mockResolvedValue([
      {
        wallet_id: 101,
        total_due: 1200,
        period_end: new Date(Date.UTC(2026, 4, 7, 12, 0, 0)),
        payment_due_date: null,
        created_at: new Date(Date.UTC(2026, 5, 6, 3, 0, 0)),
      },
    ]);
    findFirstFortnight.mockResolvedValue({ id: 36 });
    findManyPaymentPlans.mockResolvedValue([]);

    const result = await getDuePaymentsForPlannerMonth(userOwner, 2026, 6);

    expect(result.second).toHaveLength(1);
    expect(result.second[0]).toMatchObject({
      walletId: 101,
      statementDueDate: '2026-06-17',
      nextDuePayment: 0,
      effectiveAmount: 0,
      outstandingBalance: 1200,
      plannerStatus: 'falta_dato',
      obligationAmountSource: 'none',
      isEstimate: false,
      periodObligation: {
        amount: null,
        basis: 'none_declared',
        confidence: 'missing',
        gaps: ['missing_statement_payoff'],
      },
    });
  });

  it('does not estimate the corte from wallet debt when imports are unaligned', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 24, 15, 0, 0)));
    findManyWallets.mockResolvedValue([
      {
        id: 102,
        name: 'Tarjeta B',
        type: 'CREDIT_CARD',
        amount: 300,
        cutoff_day: 12,
        due_day: 27,
      },
    ]);
    queryRaw.mockResolvedValue([]);
    findManyStatementImports.mockResolvedValue([
      {
        wallet_id: 102,
        total_due: 800,
        period_end: null,
        payment_due_date: new Date(Date.UTC(2026, 4, 27, 18, 0, 0)),
        created_at: new Date(Date.UTC(2026, 4, 15, 11, 0, 0)),
      },
    ]);
    findFirstFortnight
      .mockResolvedValueOnce({ id: 37 })
      .mockResolvedValueOnce({ id: 38 });
    findManyPaymentPlans.mockResolvedValue([]);

    const result = await getDuePaymentsForPlannerMonth(userOwner, 2026, 7);

    expect(result.second).toHaveLength(1);
    expect(result.second[0]).toMatchObject({
      walletId: 102,
      nextDuePayment: 0,
      effectiveAmount: 0,
      outstandingBalance: 300,
      plannerStatus: 'falta_dato',
      obligationAmountSource: 'none',
      isEstimate: false,
      periodObligation: {
        amount: null,
        confidence: 'missing',
      },
    });
    expect(result.second[0]?.plannerStatus).not.toBe('pagado');
  });

  it('ignores legacy $0 payment plans so they do not force pagado', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 24, 15, 0, 0)));
    findManyWallets.mockResolvedValue([
      {
        id: 103,
        name: 'Tarjeta C',
        type: 'CREDIT_CARD',
        amount: 700,
        cutoff_day: 3,
        due_day: 18,
      },
    ]);
    queryRaw.mockResolvedValue([]);
    findManyStatementImports.mockResolvedValue([]);
    findManyExpenses.mockResolvedValue([]);
    findFirstFortnight
      .mockResolvedValueOnce({ id: 37 })
      .mockResolvedValueOnce({ id: 38 });
    findManyPaymentPlans.mockResolvedValue([
      {
        credit_card_wallet_id: 103,
        planned_amount: 0,
      },
    ]);

    const result = await getDuePaymentsForPlannerMonth(userOwner, 2026, 7);

    expect(result.second).toHaveLength(1);
    expect(result.second[0]).toMatchObject({
      walletId: 103,
      plannedPayment: null,
      nextDuePayment: 0,
      effectiveAmount: 0,
      outstandingBalance: 700,
      plannerStatus: 'falta_dato',
      obligationAmountSource: 'none',
      periodObligation: {
        amount: null,
        confidence: 'missing',
      },
    });
    expect(result.second[0]?.plannerStatus).not.toBe('pagado');
    expect(result.second[0]?.plannerStatus).not.toBe('sin_cargo');
  });

  it('projects active installment rows into future planner months without repeating wallet debt', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 6, 15, 0, 0)));
    findManyWallets.mockResolvedValue([
      {
        id: 29,
        name: 'Mercado Pago',
        type: 'CREDIT_CARD',
        amount: 5000,
        cutoff_day: 7,
        due_day: 17,
      },
    ]);
    queryRaw.mockResolvedValue([]);
    findManyStatementImports.mockResolvedValue([]);
    findManyExpenses.mockResolvedValue([
      {
        wallet_id: 29,
        description: 'Compra MSI',
        amount: 300,
        payment_date: new Date(Date.UTC(2026, 4, 10, 12, 0, 0)),
        created_at: new Date(Date.UTC(2026, 4, 10, 12, 0, 0)),
        credit_installment_current: 1,
        credit_installment_total: 5,
      },
    ]);
    findFirstFortnight.mockResolvedValue({ id: 40 });
    findManyPaymentPlans.mockResolvedValue([]);

    const july = await getDuePaymentsForPlannerMonth(userOwner, 2026, 7);
    const august = await getDuePaymentsForPlannerMonth(userOwner, 2026, 8);
    const september = await getDuePaymentsForPlannerMonth(userOwner, 2026, 9);
    const october = await getDuePaymentsForPlannerMonth(userOwner, 2026, 10);

    for (const month of [july, august, september]) {
      expect(month.second[0]).toMatchObject({
        walletId: 29,
        nextDuePayment: 300,
        effectiveAmount: 300,
        plannerStatus: 'por_pagar',
        obligationAmountSource: 'projection',
        isEstimate: true,
      });
    }
    // Historical month after installments end: no invented wallet-debt due.
    // Remaining debt with no cycle figure is a gap, not $0 / sin cargo.
    expect(october.second[0]).toMatchObject({
      walletId: 29,
      nextDuePayment: 0,
      effectiveAmount: 0,
      plannerStatus: 'falta_dato',
      obligationAmountSource: 'none',
      periodObligation: {
        amount: null,
        confidence: 'missing',
      },
    });
    expect(october.second[0]?.plannerStatus).not.toBe('pagado');
    expect(october.second[0]?.plannerStatus).not.toBe('sin_cargo');
  });

  it('uses the next open cycle instead of a past-due gap', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 20, 18, 0, 0)));
    findManyWallets.mockResolvedValue([
      {
        id: 8,
        name: 'Tarjeta sintetica',
        type: 'CREDIT_CARD',
        amount: 3200,
        cutoff_day: 15,
        due_day: 8,
      },
    ]);
    queryRaw.mockResolvedValue([]);
    findManyStatementImports.mockResolvedValue([]);
    findManyExpenses.mockResolvedValue([]);
    findFirstFortnight.mockResolvedValue({ id: 70 });
    findManyPaymentPlans.mockResolvedValue([]);

    const may = await getDuePaymentsForPlannerMonth(userOwner, 2026, 5);
    const june = await getDuePaymentsForPlannerMonth(userOwner, 2026, 6);

    expect([...may.first, ...may.second]).toEqual([]);
    expect(june.first[0]).toMatchObject({
      walletId: 8,
      statementDueDate: '2026-06-08',
    });
    expect(june.second).toEqual([]);
  });

  it('adds the iPad cuota and the scheduled PIF that fall in the fortnight', async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 10, 1, 18, 0, 0)));
    findManyWallets.mockResolvedValue([
      {
        id: 30,
        name: 'Liverpool Jorge',
        type: 'DEPARTMENT_STORE_CARD',
        amount: 5798,
        cutoff_day: 13,
        due_day: 13,
      },
    ]);
    queryRaw.mockResolvedValue([]);
    findManyStatementImports.mockResolvedValue([]);
    findManyExpenses.mockResolvedValue([]);
    findFirstFortnight.mockResolvedValue({ id: 80 });
    findManyPaymentPlans.mockResolvedValue([]);
    const due = new Date(Date.UTC(2026, 10, 13, 18, 0, 0));
    findManyScheduledPayments.mockResolvedValue([
      {
        id: 1,
        credit_card_wallet_id: 30,
        due_date: due,
        amount: 132,
        label: 'PIF sin intereses',
        status: 'SCHEDULED',
        paid_at: null,
        credit_card_wallet: {
          name: 'Liverpool Jorge',
          type: 'DEPARTMENT_STORE_CARD',
          cutoff_day: 13,
          due_day: 13,
        },
      },
    ]);
    findManyInstallmentPlanPayments.mockResolvedValue([
      {
        id: 9,
        sequence: 4,
        due_date: due,
        amount: 944.33,
        status: 'SCHEDULED',
        paid_at: null,
        plan: {
          id: 3,
          name: 'iPad',
          credit_card_wallet: { id: 30, name: 'Liverpool Jorge' },
        },
      },
    ]);

    const result = await getDuePaymentsForPlannerMonth(userOwner, 2026, 11);

    expect(result.first[0]).toMatchObject({
      walletId: 30,
      nextDuePayment: 1076.33,
      effectiveAmount: 1076.33,
      plannerStatus: 'por_pagar',
    });
    expect(result.second).toEqual([]);
  });
});
