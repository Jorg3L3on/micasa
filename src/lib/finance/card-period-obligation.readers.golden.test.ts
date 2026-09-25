import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentMethodType } from '@/generated/prisma/client';
import { parseCalendarDate } from '@/lib/calendar-dates';
import { toStoredPaymentPlanWrite } from '@/lib/finance/card-payment-plan-scope';
import {
  getCardPeriodObligation,
  type GetCardPeriodObligationInput,
} from '@/lib/finance/card-period-surfaces';

const {
  queryRaw,
  walletFindMany,
  walletFindFirst,
  expenseFindMany,
  fortnightFindFirst,
  fortnightFindMany,
  statementImportFindMany,
  paymentFindMany,
  paymentAggregate,
  planFindMany,
  scheduledFindMany,
  installmentPlanFindMany,
  scheduledFindFirst,
  loanFindMany,
  loanPaymentFindMany,
  templateFindMany,
  incomeFindMany,
  incomeTemplateFindMany,
} = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  walletFindMany: vi.fn(),
  walletFindFirst: vi.fn(),
  expenseFindMany: vi.fn(),
  fortnightFindFirst: vi.fn(),
  fortnightFindMany: vi.fn(),
  statementImportFindMany: vi.fn(),
  paymentFindMany: vi.fn(),
  paymentAggregate: vi.fn(),
  planFindMany: vi.fn(),
  scheduledFindMany: vi.fn(),
  installmentPlanFindMany: vi.fn(),
  scheduledFindFirst: vi.fn(),
  loanFindMany: vi.fn(),
  loanPaymentFindMany: vi.fn(),
  templateFindMany: vi.fn(),
  incomeFindMany: vi.fn(),
  incomeTemplateFindMany: vi.fn(),
}));

vi.mock('@/lib/finance/wallet-movements', () => ({
  listWalletMovements: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    $queryRaw: queryRaw,
    wallet: { findMany: walletFindMany, findFirst: walletFindFirst },
    expense: { findMany: expenseFindMany },
    fortnight: { findFirst: fortnightFindFirst, findMany: fortnightFindMany },
    creditCardStatementImport: { findMany: statementImportFindMany },
    creditCardPayment: { findMany: paymentFindMany, aggregate: paymentAggregate },
    creditCardPaymentPlan: { findMany: planFindMany },
    creditCardScheduledPayment: {
      findMany: scheduledFindMany,
      findFirst: scheduledFindFirst,
    },
    creditCardInstallmentPlan: { findMany: installmentPlanFindMany },
    creditCardInstallmentPlanPayment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    loan: { findMany: loanFindMany },
    loanPayment: { findMany: loanPaymentFindMany },
    expenseTemplate: { findMany: templateFindMany },
    income: { findMany: incomeFindMany },
    incomeTemplate: {
      findMany: incomeTemplateFindMany,
      findFirst: vi.fn().mockResolvedValue(null),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
}));

import { getCreditCardStatementByOwner } from '@/lib/finance/credit-card-statement.service';
import { getDuePaymentsForPlannerMonth } from '@/lib/finance/credit-card-statement.service';
import { getLiquidityProjection } from '@/lib/finance/liquidity-projection.service';
import { listUpcomingCommitmentsForMonth } from '@/lib/mcp/upcoming-commitments.service';

type GoldenExpect = { amount: number | null };
type GoldenCase = {
  id: string;
  query: GetCardPeriodObligationInput & { planRemainingBalance?: number };
  paymentsApplied: number;
  expect: GoldenExpect;
};

const cases = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'golden/card-obligation-cases.json'),
    'utf8',
  ),
) as GoldenCase[];

const CARD_ID = 7;

const isUtcInstant = (value: string | null | undefined) =>
  typeof value === 'string' && value.includes('T');

const materializeQuery = (query: GoldenCase['query']): GoldenCase['query'] => {
  if (!query.planWrites?.length) return query;
  const needsDateRead = query.planWrites.some(
    (write) => isUtcInstant(write.anchorStatementEnd) || isUtcInstant(write.validUntil),
  );
  if (!needsDateRead) return query;
  return {
    ...query,
    planWrites: query.planWrites.map((write) =>
      toStoredPaymentPlanWrite({
        planned_amount: write.amount,
        declared_zero: write.declaredZero === true,
        scope: write.scope,
        cycle_count: write.cycleCount,
        valid_until: write.validUntil ? new Date(write.validUntil) : null,
        anchor_statement_end: write.anchorStatementEnd
          ? new Date(write.anchorStatementEnd)
          : null,
        updated_at: write.updatedAt ? new Date(String(write.updatedAt)) : null,
        fortnight:
          write.fortnightYear != null && write.fortnightMonth != null
            ? { year: write.fortnightYear, month: write.fortnightMonth }
            : null,
      }),
    ),
  };
};

const cycleOf = (query: GoldenCase['query']) => {
  if (query.cycle) return query.cycle;
  return { statementEnd: '2026-09-15', statementDueDate: '2026-09-20' };
};

describe('golden readers agree', () => {
  beforeEach(() => {
    queryRaw.mockReset();
    walletFindMany.mockReset();
    walletFindFirst.mockReset();
    expenseFindMany.mockReset();
    fortnightFindFirst.mockReset();
    fortnightFindMany.mockReset();
    statementImportFindMany.mockReset();
    paymentFindMany.mockReset();
    paymentAggregate.mockReset();
    planFindMany.mockReset();
    scheduledFindMany.mockReset();
    installmentPlanFindMany.mockReset();
    loanFindMany.mockReset();
    loanPaymentFindMany.mockReset();
    templateFindMany.mockReset();
    incomeFindMany.mockReset();
    incomeTemplateFindMany.mockReset();
    expenseFindMany.mockResolvedValue([]);
    fortnightFindMany.mockResolvedValue([]);
    paymentFindMany.mockResolvedValue([]);
    paymentAggregate.mockResolvedValue({ _sum: { amount: 0 } });
    scheduledFindMany.mockResolvedValue([]);
    installmentPlanFindMany.mockResolvedValue([]);
    loanFindMany.mockResolvedValue([]);
    loanPaymentFindMany.mockResolvedValue([]);
    templateFindMany.mockResolvedValue([]);
    incomeFindMany.mockResolvedValue([]);
    incomeTemplateFindMany.mockResolvedValue([]);
    fortnightFindFirst.mockResolvedValue({ id: 42 });
    scheduledFindFirst.mockReset();
    scheduledFindFirst.mockResolvedValue(null);
  });

  let caseOwnerId = 1;

  it.each(cases)('$id readers match the engine', async (golden) => {
    const query = materializeQuery(golden.query);
    const cycle = cycleOf(query);
    const [year, month] = cycle.statementDueDate.split('-').map(Number);
    const cutoffDay = query.cutoffDay ?? 15;
    const dueDay = query.dueDay ?? 20;
    const asOf = parseCalendarDate(cycle.statementDueDate);
    const ownerCase = { user_id: caseOwnerId++, house_id: null } as const;
    const engine = getCardPeriodObligation({ ...query, paymentsApplied: golden.paymentsApplied });

    const card = {
      id: CARD_ID,
      name: 'Tarjeta',
      type: PaymentMethodType.CREDIT_CARD,
      amount: query.outstandingBalance,
      credit_limit: 10000,
      temporary_credit_limit: null,
      cutoff_day: cutoffDay,
      due_day: dueDay,
      minimum_payment: query.persistedMinimum ?? query.statementMinimum ?? null,
      apr_annual: null,
      cat_annual: null,
      active: true,
      include_in_liquidity: false,
    };

    walletFindFirst.mockResolvedValue(card);
    walletFindMany.mockImplementation(async (args: { where?: { type?: { in?: string[] } } }) => {
      const types = args.where?.type?.in ?? [];
      if (types.includes('CREDIT_CARD') || types.includes('DEPARTMENT_STORE_CARD')) {
        return [card];
      }
      return [
        {
          id: 10,
          name: 'Efectivo',
          type: PaymentMethodType.CASH,
          amount: 5000,
          active: true,
          include_in_liquidity: true,
        },
      ];
    });

    statementImportFindMany.mockResolvedValue(
      query.statementPayoff == null
        ? []
        : [
            {
              wallet_id: CARD_ID,
              total_due: query.statementPayoff,
              minimum_payment: query.statementMinimum ?? null,
              period_end: parseCalendarDate(cycle.statementEnd),
              payment_due_date: parseCalendarDate(cycle.statementDueDate),
              created_at: parseCalendarDate(cycle.statementEnd),
            },
          ],
    );

    const planWrites =
      query.planWrites ??
      (query.plannedOverride != null
        ? [
            {
              amount: query.plannedOverride,
              declaredZero: false,
              scope: 'this_cycle' as const,
              anchorStatementEnd: cycle.statementEnd,
              fortnightYear: year,
              fortnightMonth: month,
              updatedAt: '2026-09-01T12:00:00.000Z',
            },
          ]
        : []);

    planFindMany.mockResolvedValue(
      planWrites.map((write, index) => ({
        id: index + 1,
        credit_card_wallet_id: CARD_ID,
        planned_amount: write.amount,
        declared_zero: write.declaredZero === true,
        scope: write.scope ?? 'this_cycle',
        cycle_count: write.cycleCount ?? null,
        valid_until: write.validUntil ? parseCalendarDate(write.validUntil.slice(0, 10)) : null,
        anchor_statement_end: write.anchorStatementEnd
          ? new Date(`${write.anchorStatementEnd.slice(0, 10)}T00:00:00.000Z`)
          : null,
        updated_at: write.updatedAt ? new Date(String(write.updatedAt)) : new Date('2026-09-01T00:00:00.000Z'),
        created_at: write.createdAt ? new Date(String(write.createdAt)) : new Date('2026-09-01T00:00:00.000Z'),
        fortnight: {
          year: write.fortnightYear ?? year,
          month: write.fortnightMonth ?? month,
          period: 'FIRST',
        },
      })),
    );

    const scheduledRow =
      query.scheduledAmount != null && query.scheduledAmount > 0
        ? {
            id: 3,
            credit_card_wallet_id: CARD_ID,
            due_date: parseCalendarDate(cycle.statementDueDate),
            amount: query.scheduledAmount,
            label: null,
            status: 'SCHEDULED' as const,
            paid_at: null,
            credit_card_wallet: {
              name: 'Tarjeta',
              type: PaymentMethodType.CREDIT_CARD,
              cutoff_day: cutoffDay,
              due_day: dueDay,
            },
          }
        : null;
    scheduledFindMany.mockResolvedValue(scheduledRow ? [scheduledRow] : []);
    scheduledFindFirst.mockResolvedValue(scheduledRow);

    const msiPurchase =
      query.statementPayoff == null &&
      query.msiInstallmentDue != null &&
      query.msiInstallmentDue > 0
        ? {
            id: 11,
            wallet_id: CARD_ID,
            description: 'Cuota',
            amount: query.msiInstallmentDue,
            payment_date: parseCalendarDate(cycle.statementEnd),
            created_at: parseCalendarDate(cycle.statementEnd),
            credit_installment_current: null,
            credit_installment_total: null,
            category: { name: 'General', icon: null },
            fortnight: { id: 1, year, month, period: 'FIRST' as const },
            is_paid: true,
          }
        : null;
    expenseFindMany.mockResolvedValue(msiPurchase ? [msiPurchase] : []);

    queryRaw.mockImplementation(async (strings: TemplateStringsArray) => {
      const sql = Array.isArray(strings) ? strings.join(' ') : '';
      if (sql.includes('Expense') && msiPurchase) {
        if (sql.includes('SUM')) {
          return [{ wallet_id: CARD_ID, total: msiPurchase.amount }];
        }
        return [
          {
            wallet_id: CARD_ID,
            amount: msiPurchase.amount,
            eff: msiPurchase.payment_date,
          },
        ];
      }
      if (sql.includes('CreditCardPayment') && golden.paymentsApplied > 0) {
        if (sql.includes('SUM')) {
          return [{ credit_card_wallet_id: CARD_ID, total: golden.paymentsApplied }];
        }
        return [
          {
            credit_card_wallet_id: CARD_ID,
            amount: golden.paymentsApplied,
            paid_at: parseCalendarDate(cycle.statementDueDate),
          },
        ];
      }
      return [];
    });

    const statement = await getCreditCardStatementByOwner(CARD_ID, ownerCase, asOf);
    const planner = await getDuePaymentsForPlannerMonth(ownerCase, year, month);
    const liquidity = await getLiquidityProjection({
      ownerFilter: ownerCase,
      asOf,
      until: parseCalendarDate(cycle.statementDueDate),
      includeUnpaidExpenses: false,
      includeExpenseTemplates: false,
      omitZeroObligations: false,
    });
    const upcoming = await listUpcomingCommitmentsForMonth(ownerCase, year, month);

    const statementAmount =
      statement.period_obligation?.confidence === 'missing'
        ? null
        : (statement.period_obligation?.amount ?? null);
    const plannerRow = [...planner.first, ...planner.second].find(
      (row) => row.walletId === CARD_ID,
    );
    const plannerAmount = plannerRow
      ? plannerRow.periodObligation?.confidence === 'missing'
        ? null
        : (plannerRow.periodObligation?.amount ?? null)
      : engine.amount === 0
        ? 0
        : null;
    const liquidityRow = liquidity.milestones
      .flatMap((milestone) => milestone.obligations)
      .find((row) => row.wallet_id === CARD_ID && row.statement_due_date === cycle.statementDueDate);
    const liquidityAmount = liquidityRow ? liquidityRow.next_due_payment : engine.amount === 0 || engine.confidence === 'missing' ? engine.amount : null;
    const upcomingRow = upcoming.items.find((item) => item.source_id === CARD_ID);
    const upcomingAmount = upcomingRow ? upcomingRow.amount : engine.amount === 0 || engine.confidence === 'missing' ? engine.amount : null;

    expect(engine.amount).toBe(golden.expect.amount);
    expect(statementAmount).toBe(engine.amount);
    expect(plannerAmount).toBe(engine.amount);
    expect(liquidityAmount).toBe(engine.amount);
    expect(upcomingAmount).toBe(engine.amount);
  });
});
