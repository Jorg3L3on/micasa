import { describe, expect, it } from 'vitest';
import {
  buildCreditCardCycleLedger,
  filterCycleLedger,
  searchCycleLedger,
} from '@/lib/finance/credit-card-cycle-ledger';

describe('buildCreditCardCycleLedger', () => {
  const base = {
    cycleStart: '2026-05-07',
    cycleEnd: '2026-06-06',
    statementEnd: '2026-05-06',
    cyclePurchases: [
      {
        id: 1,
        description: 'Super',
        amount: 100,
        payment_date: '2026-05-10',
        category: 'Comida',
        categoryIcon: null,
        fortnight_id: 1,
        fortnight_year: 2026,
        fortnight_month: 5,
        fortnight_period: 'FIRST' as const,
        credit_installment_current: null,
        credit_installment_total: null,
      },
    ],
    payments: [
      {
        id: 10,
        amount: 200,
        paid_at: '2026-05-15',
        note: null,
        source_wallet_id: 2,
        source_wallet_name: 'Efectivo',
        credit_card_wallet_id: 5,
        credit_card_wallet_name: 'TC',
      },
      {
        id: 11,
        amount: 50,
        paid_at: '2026-04-20',
        note: null,
        source_wallet_id: 2,
        source_wallet_name: 'Efectivo',
        credit_card_wallet_id: 5,
        credit_card_wallet_name: 'TC',
      },
    ],
    imports: [
      {
        id: 99,
        provider: 'mercado_pago',
        created_at: '2026-05-07T10:00:00.000Z',
        period_start: '2026-04-07T00:00:00.000Z',
        period_end: '2026-05-06T00:00:00.000Z',
        account_number: null,
        statement_issue_date: null,
        payment_due_date: null,
        total_due: 3000,
        minimum_payment: 300,
        file_name: 'estado.pdf',
        has_file: true,
        expense_count: 12,
        parse_warnings: [],
      },
    ],
  };

  it('merges purchases, in-cycle payments, and aligned imports sorted desc', () => {
    const ledger = buildCreditCardCycleLedger(base);
    expect(ledger).toHaveLength(3);
    expect(ledger[0].kind).toBe('payment');
    expect(ledger[1].kind).toBe('purchase');
    expect(ledger[2].kind).toBe('import');
  });

  it('excludes payments outside the cycle window', () => {
    const ledger = buildCreditCardCycleLedger(base);
    expect(ledger.filter((e) => e.kind === 'payment')).toHaveLength(1);
  });

  it('filters and searches ledger entries', () => {
    const ledger = buildCreditCardCycleLedger(base);
    expect(filterCycleLedger(ledger, 'purchases')).toHaveLength(1);
    expect(filterCycleLedger(ledger, 'payments')).toHaveLength(1);
    expect(filterCycleLedger(ledger, 'imports')).toHaveLength(1);
    expect(searchCycleLedger(ledger, 'super')).toHaveLength(1);
    expect(searchCycleLedger(ledger, 'efectivo')).toHaveLength(1);
  });
});
