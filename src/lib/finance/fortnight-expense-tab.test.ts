import { describe, expect, it } from 'vitest';

import {
  countUnpaidFortnightExpenses,
  filterFortnightExpenseTabRows,
  presentFortnightExpenseTab,
  type FortnightPlannerMoneyTotals,
} from '@/lib/finance/fortnight-expense-tab';
import type { TransactionRow } from '@/types/catalog';

const row = (
  partial: Pick<TransactionRow, 'id' | 'description'> &
    Partial<TransactionRow>,
): TransactionRow => ({
  date: '2026-09-15',
  amount: 10,
  category: 'General',
  paymentMethod: 'Efectivo',
  type: 'expense',
  is_paid: false,
  planning_row_kind: 'expense',
  ...partial,
});

const totals: FortnightPlannerMoneyTotals = {
  pagado: 400,
  pendiente: 250,
  presupuesto: 80,
  liquidez: -30,
};

describe('filterFortnightExpenseTabRows', () => {
  const expense = row({ id: 1, description: 'Supermercado' });
  const cardCharge = row({
    id: 2,
    description: 'Farmacia',
    wallet_type: 'CREDIT_CARD',
  });
  const income = row({
    id: 3,
    description: 'Nómina',
    type: 'income',
    is_paid: true,
    planning_row_kind: undefined,
  });
  const cardPayment = row({
    id: 4,
    description: 'Supermercado',
    planning_row_kind: 'card_payment',
    is_paid: true,
  });
  const pendingCard = row({
    id: 5,
    description: 'Pago tarjeta: demo',
    planning_row_kind: 'card_payment',
    is_paid: false,
  });
  const walletLoan = row({
    id: 6,
    description: 'Pagar a demo',
    planning_row_kind: 'loan_payment',
    loan_payment_source: 'WALLET',
  });
  const payrollLoan = row({
    id: 7,
    description: 'Renta',
    planning_row_kind: 'loan_payment',
    loan_payment_source: 'PAYROLL_DEDUCTION',
  });
  const looksLikeCardButIsExpense = row({
    id: 8,
    description: 'Pago tarjeta: anotación del usuario',
    planning_row_kind: 'expense',
  });

  const mixed = [
    expense,
    cardCharge,
    income,
    cardPayment,
    pendingCard,
    walletLoan,
    payrollLoan,
    looksLikeCardButIsExpense,
  ];

  it('hides card and loan movements by kind, including payroll deductions', () => {
    expect(filterFortnightExpenseTabRows(mixed).map((item) => item.id)).toEqual([
      1, 2, 3, 8,
    ]);
  });

  it('keeps a normal expense whose description mentions a card or loan payment', () => {
    expect(
      filterFortnightExpenseTabRows([looksLikeCardButIsExpense, walletLoan]).map(
        (item) => item.id,
      ),
    ).toEqual([8]);
  });

  it('counts only unpaid expenses for the Gastos chip', () => {
    const paidExpense = row({
      id: 9,
      description: 'Luz',
      is_paid: true,
    });
    expect(countUnpaidFortnightExpenses([...mixed, paidExpense])).toBe(3);
  });

  it('does not change paid, pending, budget, or liquidity totals', () => {
    const view = presentFortnightExpenseTab({ rows: mixed, totals });

    expect(view.totals).toBe(totals);
    expect(view.totals).toEqual({
      pagado: 400,
      pendiente: 250,
      presupuesto: 80,
      liquidez: -30,
    });
    expect(view.rows.map((item) => item.id)).toEqual([1, 2, 3, 8]);
    expect(view.unpaidCount).toBe(3);
    const visibleAmount = view.rows.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );
    expect(visibleAmount).not.toBe(view.totals.pendiente);
    expect(visibleAmount).not.toBe(view.totals.pagado);
  });
});
