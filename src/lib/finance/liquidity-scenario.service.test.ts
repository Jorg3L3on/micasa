import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCalendarDate } from '@/lib/calendar-dates';
import { PaymentMethodType } from '@/generated/prisma/client';

const { findManyWallet, writes } = vi.hoisted(() => ({
  findManyWallet: vi.fn(),
  writes: {
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    $executeRaw: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/finance/wallet-movements', () => ({
  listWalletMovements: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/prisma', () => {
  const readModel = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    create: writes.create,
    createMany: writes.createMany,
    update: writes.update,
    updateMany: writes.updateMany,
    upsert: writes.upsert,
    delete: writes.delete,
    deleteMany: writes.deleteMany,
  });
  return {
    default: {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $executeRaw: writes.$executeRaw,
      $executeRawUnsafe: writes.$executeRawUnsafe,
      $transaction: writes.$transaction,
      wallet: { ...readModel(), findMany: findManyWallet },
      expense: readModel(),
      fortnight: readModel(),
      expenseTemplate: readModel(),
      income: readModel(),
      incomeTemplate: readModel(),
      loanPayment: readModel(),
      loan: readModel(),
      creditCardStatementImport: readModel(),
      creditCardPayment: readModel(),
      creditCardInstallmentPlan: readModel(),
      creditCardPaymentPlan: readModel(),
      creditCardScheduledPayment: readModel(),
    },
  };
});

import {
  getLiquidityProjection,
  LiquidityScenarioWalletError,
  type LiquidityProjectionResult,
} from '@/lib/finance/liquidity-projection.service';
import { isCreditInstallmentExpense } from '@/lib/finance/expense-planning-scope';
import type { LiquidityScenarioItem } from '@/schemas/liquidity-scenario.schema';

const userOwner = { user_id: 1, house_id: null } as const;
const until = parseCalendarDate('2026-06-30');

const cash = {
  id: 10,
  name: 'Efectivo',
  type: PaymentMethodType.CASH,
  amount: '500',
  active: true,
  cutoff_day: null,
  due_day: null,
};

const visa = {
  id: 7,
  name: 'Visa',
  type: PaymentMethodType.CREDIT_CARD,
  amount: '0',
  credit_limit: '10000',
  temporary_credit_limit: null,
  cutoff_day: 15,
  due_day: 20,
  active: true,
};

const ownedWallets = [cash, visa];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(2026, 2, 10, 12, 0, 0)));
  findManyWallet.mockReset();
  findManyWallet.mockImplementation(
    async (args: { where: { id?: { in: number[] }; type?: { in: string[] }; user_id?: number } }) => {
      const where = args.where ?? {};
      if (where.id?.in) {
        // The query is scoped by owner: another owner's wallet is simply not found.
        return where.user_id === userOwner.user_id
          ? ownedWallets.filter((w) => where.id!.in.includes(w.id))
          : [];
      }
      const types = where.type?.in ?? [];
      if (types.includes(PaymentMethodType.CREDIT_CARD)) return [visa];
      return [cash];
    },
  );
  for (const spy of Object.values(writes)) spy.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

const project = (scenario?: LiquidityScenarioItem[]) =>
  getLiquidityProjection({ ownerFilter: userOwner, until, scenario });

const scenarioLines = (result: LiquidityProjectionResult) =>
  result.milestones.flatMap((m) =>
    m.obligations
      .filter((o) => o.source === 'scenario')
      .map((o) => ({ due: m.due_date, ...o })),
  );

const withoutScenarioLines = (result: LiquidityProjectionResult) =>
  result.milestones
    .map((m) => ({
      due_date: m.due_date,
      obligations: m.obligations.filter((o) => o.source !== 'scenario'),
    }))
    .filter((m) => m.obligations.length > 0);

const expectSummaryAlgebra = (result: LiquidityProjectionResult) => {
  const monthlyDebt = result.monthly_series.reduce((s, m) => s + m.total_payments_due, 0);
  const milestoneDebt = result.milestones.reduce((s, m) => s + m.total_due, 0);
  expect(result.summary.total_obligations_due_on_or_before_until).toBeCloseTo(monthlyDebt, 6);
  expect(result.summary.total_obligations_due_on_or_before_until).toBeCloseTo(milestoneDebt, 6);
  expect(result.summary.net_liquidity_versus_obligations_including_income).toBeCloseTo(
    result.summary.funding_total +
      result.summary.expected_income_total_on_or_before_until -
      result.summary.total_obligations_due_on_or_before_until,
    6,
  );
  for (const month of result.monthly_series) {
    expect(month.total_payments_due).toBeCloseTo(
      month.msi_debt_total +
        month.installment_payment_total +
        month.loan_payment_total +
        month.expense_template_total +
        month.other_debt_components_total,
      6,
    );
  }
};

describe('getLiquidityProjection with a scenario', () => {
  it('leaves the output unchanged without a scenario', async () => {
    const baseline = await project();
    expect(baseline).not.toHaveProperty('scenario_delta');
    expect(baseline).not.toHaveProperty('scenario_assumptions');
    expect(await project([])).toEqual(baseline);
  });

  it('a purchase on a funding wallet leaves cash on its date and creates the shortfall', async () => {
    const baseline = await project();
    const result = await project([
      { kind: 'purchase', amount: 800, date: '2026-03-20', wallet_id: 10 },
    ]);

    expect(scenarioLines(result)).toEqual([
      expect.objectContaining({
        due: '2026-03-20',
        source: 'scenario',
        wallet_id: 10,
        next_due_payment: 800,
        scenario_kind: 'purchase',
        scenario_charge_date: '2026-03-20',
      }),
    ]);
    expect(baseline.summary.first_projected_shortfall_date).toBeNull();
    expect(result.summary.first_projected_shortfall_date).toBe('2026-03-20');
    expect(result.monthly_series.find((m) => m.month_key === '2026-03')?.other_debt_components_total).toBe(800);

    expect(result.scenario_delta).toEqual({
      baseline: {
        first_projected_shortfall_date: null,
        min_projected_headroom: baseline.milestones.length > 0 ? expect.any(Number) : null,
        end_liquidity: baseline.summary.net_liquidity_versus_obligations_including_income,
      },
      scenario: {
        first_projected_shortfall_date: '2026-03-20',
        min_projected_headroom: -300,
        end_liquidity: baseline.summary.net_liquidity_versus_obligations_including_income - 800,
      },
      first_projected_shortfall_changed: true,
      min_projected_headroom_change: baseline.milestones.length > 0 ? expect.any(Number) : null,
      end_liquidity_change: -800,
    });
    expect(result.scenario_assumptions).toEqual([
      expect.stringMatching(/^Compra hipotética de \$800\.00 el día .+ con Efectivo; no se guardó\.$/),
    ]);
    expect(withoutScenarioLines(result)).toEqual(withoutScenarioLines(baseline));
    expectSummaryAlgebra(result);
  });

  it('an instalment on a funding wallet leaves cash once a month from the first date', async () => {
    const result = await project([
      { kind: 'instalment', amount: 100, firstDate: '2026-03-31', months: 3, wallet_id: 10 },
    ]);

    expect(scenarioLines(result).map((o) => [o.due, o.next_due_payment, o.scenario_instalment_number])).toEqual([
      ['2026-03-31', 100, 1],
      ['2026-04-30', 100, 2],
      ['2026-05-31', 100, 3],
    ]);
    // A funding instalment is a cash bill, not a card cuota.
    expect(scenarioLines(result).every((o) => o.credit_installment_total == null)).toBe(true);
    expect(result.scenario_delta?.end_liquidity_change).toBe(-300);
    expect(result.summary.first_projected_shortfall_date).toBeNull();
    expect(result.scenario_delta?.first_projected_shortfall_changed).toBe(false);
    expectSummaryAlgebra(result);
  });

  it('a purchase on a card reaches cash on the due date of the statement that bills it', async () => {
    const baseline = await project();
    const beforeCutoff = await project([
      { kind: 'purchase', amount: 1000, date: '2026-03-12', wallet_id: 7 },
    ]);
    const afterCutoff = await project([
      { kind: 'purchase', amount: 1000, date: '2026-03-16', wallet_id: 7 },
    ]);

    expect(scenarioLines(beforeCutoff)).toEqual([
      expect.objectContaining({
        due: '2026-03-20',
        wallet_id: 7,
        statement_end: '2026-03-15',
        next_due_payment: 1000,
        scenario_charge_date: '2026-03-12',
      }),
    ]);
    expect(scenarioLines(afterCutoff)).toEqual([
      expect.objectContaining({
        due: '2026-04-20',
        statement_end: '2026-04-15',
        next_due_payment: 1000,
      }),
    ]);
    // Nothing leaves cash on the purchase day itself.
    expect(afterCutoff.milestones.some((m) => m.due_date === '2026-03-16')).toBe(false);

    // Counted once: the card's own statement line is untouched and the total moves by the purchase.
    expect(withoutScenarioLines(afterCutoff)).toEqual(withoutScenarioLines(baseline));
    expect(
      afterCutoff.summary.total_obligations_due_on_or_before_until -
        baseline.summary.total_obligations_due_on_or_before_until,
    ).toBe(1000);
    expect(afterCutoff.monthly_series.find((m) => m.month_key === '2026-04')?.msi_debt_total).toBe(1000);

    const card = afterCutoff.card_utilization_summary.cards.find((c) => c.card_id === 7);
    expect(card?.used_amount).toBe(1000);
    expect(card?.utilization_percent).toBe(10);
    expect(afterCutoff.scenario_delta?.scenario.first_projected_shortfall_date).toBe('2026-04-20');
    expectSummaryAlgebra(afterCutoff);
  });

  it('an instalment on a card is a cuota that follows the statement cycle', async () => {
    const baseline = await project();
    const result = await project([
      { kind: 'instalment', amount: 300, firstDate: '2026-03-16', months: 3, wallet_id: 7 },
    ]);
    const lines = scenarioLines(result);

    expect(lines.map((o) => [o.scenario_charge_date, o.due, o.next_due_payment])).toEqual([
      ['2026-03-16', '2026-04-20', 300],
      ['2026-04-16', '2026-05-20', 300],
      ['2026-05-16', '2026-06-20', 300],
    ]);
    for (const [i, line] of lines.entries()) {
      expect(
        isCreditInstallmentExpense({
          credit_installment_current: line.credit_installment_current ?? null,
          credit_installment_total: line.credit_installment_total ?? null,
        }),
      ).toBe(true);
      expect(line.credit_installment_current).toBe(i + 1);
      expect(line.credit_installment_total).toBe(3);
    }

    // In the series it is a cuota (installment line), not a statement balance.
    for (const key of ['2026-04', '2026-05', '2026-06']) {
      const month = result.monthly_series.find((m) => m.month_key === key)!;
      const before = baseline.monthly_series.find((m) => m.month_key === key)!;
      expect(month.installment_payment_total - before.installment_payment_total).toBe(300);
      expect(month.msi_debt_total).toBe(before.msi_debt_total);
    }
    expect(
      result.summary.total_obligations_due_on_or_before_until -
        baseline.summary.total_obligations_due_on_or_before_until,
    ).toBe(900);
    expect(result.card_utilization_summary.cards.find((c) => c.card_id === 7)?.used_amount).toBe(900);
    expect(result.scenario_assumptions?.[0]).toMatch(/mensualidad en la tarjeta/);
    expectSummaryAlgebra(result);
  });

  it('keeps the summary algebra with several items across wallets', async () => {
    const result = await project([
      { kind: 'purchase', amount: 250.5, date: '2026-04-01', wallet_id: 10 },
      { kind: 'purchase', amount: 400, date: '2026-05-02', wallet_id: 7 },
      { kind: 'instalment', amount: 120, firstDate: '2026-03-15', months: 6, wallet_id: 7 },
    ]);
    expect(result.scenario_assumptions).toHaveLength(3);
    expectSummaryAlgebra(result);
  });

  it('drops charges whose cash date falls after until', async () => {
    const result = await project([
      { kind: 'purchase', amount: 500, date: '2026-06-25', wallet_id: 7 },
    ]);
    // Billed on the July statement: outside the horizon, so the projection does not move.
    expect(scenarioLines(result)).toEqual([]);
    expect(result.scenario_delta?.end_liquidity_change).toBe(0);
    expect(result.scenario_delta?.first_projected_shortfall_changed).toBe(false);
  });

  it('rejects a wallet that is not in the owner context', async () => {
    await expect(
      project([
        { kind: 'purchase', amount: 100, date: '2026-03-20', wallet_id: 10 },
        { kind: 'purchase', amount: 100, date: '2026-03-20', wallet_id: 99 },
      ]),
    ).rejects.toMatchObject({
      name: 'DomainError',
      code: 'INVALID_SCENARIO',
      index: 1,
      message: 'Elige una billetera de este espacio.',
    });
    const lookup = findManyWallet.mock.calls.find(
      ([args]) => (args as { where: { id?: unknown } }).where.id != null,
    )?.[0] as { where: Record<string, unknown> };
    expect(lookup.where).toMatchObject({ user_id: 1, house_id: null });

    const otherOwner = getLiquidityProjection({
      ownerFilter: { user_id: null, house_id: 5 },
      until,
      scenario: [{ kind: 'purchase', amount: 100, date: '2026-03-20', wallet_id: 10 }],
    });
    await expect(otherOwner).rejects.toBeInstanceOf(LiquidityScenarioWalletError);
  });

  it('rejects a card without cutoff and due days, and an archived wallet', async () => {
    ownedWallets.push(
      { ...visa, id: 8, name: 'Sin corte', cutoff_day: null as unknown as number, due_day: null as unknown as number },
      { ...cash, id: 11, name: 'Vieja', active: false },
    );
    try {
      await expect(
        project([{ kind: 'purchase', amount: 100, date: '2026-03-20', wallet_id: 8 }]),
      ).rejects.toThrow(/no tiene día de corte/);
      await expect(
        project([{ kind: 'purchase', amount: 100, date: '2026-03-20', wallet_id: 11 }]),
      ).rejects.toThrow(/archivada/);
    } finally {
      ownedWallets.splice(2);
    }
  });

  it('never writes to the database', async () => {
    await project([
      { kind: 'purchase', amount: 800, date: '2026-03-20', wallet_id: 10 },
      { kind: 'instalment', amount: 300, firstDate: '2026-03-16', months: 3, wallet_id: 7 },
    ]);
    for (const spy of Object.values(writes)) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
