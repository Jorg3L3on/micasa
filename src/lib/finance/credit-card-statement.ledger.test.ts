import { describe, expect, it } from 'vitest';
import {
  computeObligationBreakdownFromLedger,
  resolveCreditCardStatementWindow,
  type CardLedgerExpenseRow,
  type CardLedgerPaymentRow,
} from '@/lib/finance/credit-card-statement.service';

describe('computeObligationBreakdownFromLedger', () => {
  const asOf = new Date(Date.UTC(2026, 2, 10));
  const window = resolveCreditCardStatementWindow(asOf, 15, 20);
  const cardId = 42;

  it('matches statement purchases and applied payments', () => {
    const expenses: CardLedgerExpenseRow[] = [
      {
        wallet_id: cardId,
        amount: 100,
        effectiveAt: new Date(Date.UTC(2026, 0, 20)),
      },
      {
        wallet_id: cardId,
        amount: 50,
        effectiveAt: new Date(Date.UTC(2026, 1, 10)),
      },
    ];
    const payments: CardLedgerPaymentRow[] = [
      {
        credit_card_wallet_id: cardId,
        amount: 40,
        paid_at: new Date(Date.UTC(2026, 1, 18)),
      },
    ];

    const map = computeObligationBreakdownFromLedger(
      [cardId],
      window,
      expenses,
      payments,
    );
    const row = map.get(cardId)!;
    expect(row.last_statement_balance).toBe(150);
    expect(row.payments_applied_to_statement).toBe(40);
    expect(row.next_due_payment).toBe(110);
  });

  it('sums current cycle purchases separately', () => {
    const expenses: CardLedgerExpenseRow[] = [
      {
        wallet_id: cardId,
        amount: 200,
        effectiveAt: window.currentCycleStart,
      },
      {
        wallet_id: cardId,
        amount: 50,
        effectiveAt: window.currentCycleEnd,
      },
    ];
    const map = computeObligationBreakdownFromLedger(
      [cardId],
      window,
      expenses,
      [],
    );
    expect(map.get(cardId)!.current_cycle_purchases).toBe(250);
  });

  it('does not count same-UTC-day payment before cutoff instant toward statement', () => {
    const expenses: CardLedgerExpenseRow[] = [
      {
        wallet_id: cardId,
        amount: 200,
        effectiveAt: new Date(Date.UTC(2026, 0, 20)),
      },
    ];
    const payments: CardLedgerPaymentRow[] = [
      {
        credit_card_wallet_id: cardId,
        amount: 200,
        paid_at: new Date(Date.UTC(2026, 1, 15, 10, 0, 0, 0)),
      },
    ];

    const map = computeObligationBreakdownFromLedger(
      [cardId],
      window,
      expenses,
      payments,
    );
    const row = map.get(cardId)!;
    expect(row.last_statement_balance).toBe(200);
    expect(row.payments_applied_to_statement).toBe(0);
    expect(row.next_due_payment).toBe(200);
  });

  it('counts same-UTC-day payment after cutoff instant toward statement', () => {
    const expenses: CardLedgerExpenseRow[] = [
      {
        wallet_id: cardId,
        amount: 200,
        effectiveAt: new Date(Date.UTC(2026, 0, 20)),
      },
    ];
    const payments: CardLedgerPaymentRow[] = [
      {
        credit_card_wallet_id: cardId,
        amount: 200,
        paid_at: new Date(Date.UTC(2026, 1, 15, 14, 0, 0, 0)),
      },
    ];

    const map = computeObligationBreakdownFromLedger(
      [cardId],
      window,
      expenses,
      payments,
    );
    const row = map.get(cardId)!;
    expect(row.payments_applied_to_statement).toBe(200);
    expect(row.next_due_payment).toBe(0);
  });
});
