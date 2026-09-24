import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dueItemToPeriodObligation } from '@/lib/finance/card-period-obligation';
import {
  getCardPeriodObligation,
  liquiditySnapshotFromQuery,
  mcpSnapshotFromDueItem,
  panelSnapshotFromDueItem,
  planContributionFromObligation,
  type GetCardPeriodObligationInput,
} from '@/lib/finance/card-period-surfaces';
import type { DueItemObligationSource } from '@/lib/finance/card-period-obligation';
import { splitAggregatedDueAndInstallment } from '@/lib/finance/credit-card-msi-period-due';

type GoldenExpect = {
  amount: number | null;
  basis: string;
  confidence: string;
  gaps: string[];
  plannerStatus: string;
  countsAsGap: boolean;
  countsAsPending: boolean;
  entersAlcanza: boolean;
  knownCashAmount: number | null;
};

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

const dueItemFor = (query: GoldenCase['query']): DueItemObligationSource => {
  const obligation = getCardPeriodObligation(query);
  const scheduled =
    query.scheduledAmount != null &&
    query.scheduledAmount > 0 &&
    query.statementPayoff == null &&
    obligation.basis === 'msi_installments' &&
    query.msiInstallmentDue == null;
  return {
    outstandingBalance: query.outstandingBalance,
    statementPayoff: scheduled ? null : (query.statementPayoff ?? null),
    nextDuePayment: scheduled ? (query.scheduledAmount ?? 0) : (query.statementPayoff ?? 0),
    obligationAmountSource: scheduled
      ? 'scheduled_calendar'
      : query.statementPayoff != null
        ? 'import'
        : 'none',
    minimumPayment:
      query.statementPayoff != null ? null : (query.persistedMinimum ?? query.statementMinimum ?? null),
    msiInstallmentDue: scheduled ? null : (query.msiInstallmentDue ?? null),
    plannedPayment: obligation.basis === 'planned_override' ? obligation.amount : null,
    declaredZero: false,
    paymentsAppliedToStatement: query.paymentsApplied ?? 0,
    paymentsAppliedToFortnight: 0,
  };
};

describe('card period obligation golden surfaces', () => {
  it.each(cases)('$id matches on panel, liquidity and MCP', (golden) => {
    const panel = panelSnapshotFromDueItem(dueItemFor(golden.query));
    const liquidity = liquiditySnapshotFromQuery(golden.query);
    const mcp = mcpSnapshotFromDueItem(dueItemFor(golden.query));

    expect(liquidity.amount).toBe(golden.expect.amount);
    expect(liquidity.basis).toBe(golden.expect.basis);
    expect(liquidity.confidence).toBe(golden.expect.confidence);
    expect(liquidity.gaps).toEqual(golden.expect.gaps);
    expect(liquidity.plannerStatus).toBe(golden.expect.plannerStatus);
    expect(liquidity.countsAsGap).toBe(golden.expect.countsAsGap);
    expect(liquidity.countsAsPending).toBe(golden.expect.countsAsPending);
    expect(liquidity.entersAlcanza).toBe(golden.expect.entersAlcanza);
    expect(liquidity.knownCashAmount).toBe(golden.expect.knownCashAmount);

    expect(panel).toEqual(liquidity);
    expect(mcp).toEqual(liquidity);

    if (golden.expect.confidence === 'missing') {
      expect(panel.amount).toBeNull();
      expect(panel.knownCashAmount).not.toBe(0);
      const plan = planContributionFromObligation(getCardPeriodObligation(golden.query));
      expect(plan.statementDue).toBeNull();
      expect(plan.gap).toBe('missing_statement');
    }
  });

  it('statement payoff is not added again to the MSI installment', () => {
    const statementCase = cases.find((row) => row.id === 'statement-plus-msi-no-double-count');
    expect(statementCase).toBeDefined();
    const obligation = getCardPeriodObligation(statementCase!.query);
    const split = splitAggregatedDueAndInstallment({
      aggregatedDue: obligation.amount ?? 0,
      installmentDue: statementCase!.query.msiInstallmentDue ?? 0,
    });
    expect(split.periodDue).toBe(1500);
    expect(split.periodDue).not.toBe(1500 + 500);
    expect(split.periodDue).not.toBe(statementCase!.query.planRemainingBalance);
  });

  it('msi-only amount is the installment, not the plan balance', () => {
    const msiCase = cases.find((row) => row.id === 'msi-installment-only');
    const obligation = getCardPeriodObligation(msiCase!.query);
    expect(obligation.amount).toBe(1000);
    expect(obligation.amount).not.toBe(msiCase!.query.planRemainingBalance);
    expect(dueItemToPeriodObligation(dueItemFor(msiCase!.query)).amount).toBe(1000);
  });

  it('a later period inside n_cycles keeps the last write', () => {
    const scoped = cases.find((row) => row.id === 'last-write-wins-inside-scope');
    const nextCycle = getCardPeriodObligation({
      ...scoped!.query,
      cycle: {
        statementEnd: '2026-11-15',
        statementDueDate: '2026-11-20',
      },
    });
    expect(nextCycle.amount).toBe(900);
    expect(nextCycle.basis).toBe('planned_override');
    const outside = getCardPeriodObligation({
      ...scoped!.query,
      cycle: {
        statementEnd: '2026-12-15',
        statementDueDate: '2026-12-20',
      },
    });
    expect(outside.basis).not.toBe('planned_override');
    expect(outside.amount).toBe(2000);
  });
});
