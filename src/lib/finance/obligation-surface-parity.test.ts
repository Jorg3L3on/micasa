import { describe, expect, it } from 'vitest';
import { getEffectiveCardPaymentAmount } from '@/lib/finance/credit-card-payment-plan.utils';
import {
  buildCardObligationsFromLedger,
  resolveCreditCardStatementWindow,
  resolveImportedTotalDueForStatementWindow,
  type CardLedgerExpenseRow,
  type CardLedgerPaymentRow,
  type StatementImportRow,
} from '@/lib/finance/credit-card-statement.service';
import { mergePlanningCardTotalsIntoExpenseSummary } from '@/lib/finance/planning-period-card-totals';
import { formatCalendarDate } from '@/lib/calendar-dates';

const sumEffectiveDue = (
  items: Array<{
    nextDuePayment: number;
    plannedPayment?: number | null;
    paymentsAppliedToStatement?: number;
  }>,
) =>
  items
    .filter((i) => getEffectiveCardPaymentAmount(i) > 0)
    .reduce((s, i) => s + getEffectiveCardPaymentAmount(i), 0);

describe('obligation surface parity (fixture ledger)', () => {
  const asOf = new Date(Date.UTC(2026, 2, 10));
  const window = resolveCreditCardStatementWindow(asOf, 15, 20);
  const asOfYmd = formatCalendarDate(asOf);

  const card = {
    walletId: 7,
    walletName: 'Visa',
    walletType: 'CREDIT_CARD',
    outstandingBalance: 50,
    cutoffDay: 15,
    dueDay: 20,
    importedTotalDue: null as number | null,
  };

  const expenses: CardLedgerExpenseRow[] = [
    {
      wallet_id: 7,
      amount: 500,
      effectiveAt: new Date(Date.UTC(2026, 1, 5)),
    },
  ];

  const payments: CardLedgerPaymentRow[] = [
    {
      credit_card_wallet_id: 7,
      amount: 100,
      paid_at: new Date(Date.UTC(2026, 1, 18)),
    },
  ];

  it('liquidity kernel matches planner effective due for same ledger', () => {
    const breakdown = buildCardObligationsFromLedger(
      [card],
      window,
      expenses,
      payments,
      asOfYmd,
    );
    const row = breakdown.get(7)!;
    const plannerItem = {
      nextDuePayment: row.next_due_payment,
      paymentsAppliedToStatement: row.payments_applied_to_statement,
      plannedPayment: null as number | null,
    };
    expect(row.next_due_payment).toBe(400);
    expect(sumEffectiveDue([plannerItem])).toBe(400);
  });

  it('imported total_due overrides ledger for both surfaces', () => {
    const imports: StatementImportRow[] = [
      {
        wallet_id: 7,
        total_due: 600,
        period_end: window.statementEnd,
        created_at: new Date(Date.UTC(2026, 2, 1)),
      },
    ];
    const imported = resolveImportedTotalDueForStatementWindow(imports, 7, window);
    expect(imported).toBe(600);

    const breakdown = buildCardObligationsFromLedger(
      [{ ...card, importedTotalDue: imported }],
      window,
      expenses,
      payments,
      asOfYmd,
    );
    expect(breakdown.get(7)?.next_due_payment).toBe(500);
  });

  it('orphan payment + reduced card due does not inflate unpaid twice', () => {
    const breakdown = buildCardObligationsFromLedger(
      [card],
      window,
      expenses,
      payments,
      asOfYmd,
    );
    const cardDueTotal = breakdown.get(7)?.next_due_payment ?? 0;
    const orphanTotal = 100;

    const totals = mergePlanningCardTotalsIntoExpenseSummary(
      { totalExpense: 0, totalPaid: 0, totalUnpaid: 0 },
      { total: orphanTotal, count: 1 },
      { total: cardDueTotal, cardCount: 1 },
    );

    expect(totals.totalExpense).toBe(orphanTotal + cardDueTotal);
    expect(totals.totalPaid).toBe(orphanTotal);
    expect(totals.totalUnpaid).toBe(cardDueTotal);
  });

  it('wallet debt fallback when ledger is zero but outstanding balance remains', () => {
    const breakdown = buildCardObligationsFromLedger(
      [{ ...card, outstandingBalance: 250 }],
      window,
      [],
      [],
      asOfYmd,
    );
    expect(breakdown.get(7)?.next_due_payment).toBe(250);
    expect(breakdown.get(7)?.is_estimate).toBe(true);
  });
});
