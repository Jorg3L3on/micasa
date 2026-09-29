import { describe, expect, it } from 'vitest';

import {
  countUnpaidFortnightExpenses,
  filterFortnightExpenseTabRows,
  presentFortnightExpenseTab,
  shouldShowCashFlowFooter,
  sumCashFlowFooterTotal,
  visibleFortnightExpenseDateKeys,
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
  const expense = row({ id: 1, description: 'Supermercado', amount: 100 });
  const cardCharge = row({
    id: 2,
    description: 'Farmacia',
    amount: 50,
    wallet_type: 'CREDIT_CARD',
  });
  const income = row({
    id: 3,
    description: 'Nómina',
    amount: 20,
    type: 'income',
    is_paid: true,
    planning_row_kind: undefined,
  });
  const cardPayment = row({
    id: 4,
    description: 'Supermercado',
    amount: 40,
    planning_row_kind: 'card_payment',
    is_paid: true,
  });
  const pendingCard = row({
    id: 5,
    description: 'Pago tarjeta: demo',
    amount: 30,
    planning_row_kind: 'card_payment',
    is_paid: false,
  });
  const walletLoan = row({
    id: 6,
    description: 'Pagar a demo',
    amount: 25,
    planning_row_kind: 'loan_payment',
    loan_payment_source: 'WALLET',
  });
  const payrollLoan = row({
    id: 7,
    description: 'Renta',
    amount: 15,
    planning_row_kind: 'loan_payment',
    loan_payment_source: 'PAYROLL_DEDUCTION',
  });
  const looksLikeCardButIsExpense = row({
    id: 8,
    description: 'Pago tarjeta: anotación del usuario',
    amount: 10,
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
    const before = {
      pagado: totals.pagado,
      pendiente: totals.pendiente,
      presupuesto: totals.presupuesto,
      liquidez: totals.liquidez,
    };
    const view = presentFortnightExpenseTab({ rows: mixed, totals });

    expect(view.totals.pagado).toBe(before.pagado);
    expect(view.totals.pendiente).toBe(before.pendiente);
    expect(view.totals.presupuesto).toBe(before.presupuesto);
    expect(view.totals.liquidez).toBe(before.liquidez);
    expect(view.totals).toBe(totals);
    expect(view.rows.map((item) => item.id)).toEqual([1, 2, 3, 8]);
    expect(view.unpaidCount).toBe(3);
  });

  it('keeps the efectivo/débito footer total when the Gastos list is filtered', () => {
    const before = sumCashFlowFooterTotal(mixed);
    const view = presentFortnightExpenseTab({ rows: mixed, totals });
    const footerTotal = sumCashFlowFooterTotal(view.cashFlowRows);
    const visibleOnlyTotal = sumCashFlowFooterTotal(view.rows);

    expect(view.cashFlowRows).toBe(mixed);
    expect(footerTotal).toBe(before);
    expect(footerTotal).toBe(240);
    expect(visibleOnlyTotal).toBe(130);
    expect(footerTotal).toBe(
      visibleOnlyTotal +
        Number(cardPayment.amount) +
        Number(pendingCard.amount) +
        Number(walletLoan.amount) +
        Number(payrollLoan.amount),
    );
    expect(shouldShowCashFlowFooter(view.rows.length)).toBe(true);
  });

  it('hides settled loan expenses linked by loan_payment_id, not by description', () => {
    const settledWallet = row({
      id: 12,
      description: 'Pago préstamo: Auto (Banco)',
      amount: 60,
      is_paid: true,
      planning_row_kind: 'expense',
      loan_payment_id: 22,
    });
    const settledLenderBatch = row({
      id: 13,
      description: 'Pago a Banco',
      amount: 90,
      is_paid: true,
      planning_row_kind: 'expense',
      lender_payment_id: 70,
    });
    const userNote = row({
      id: 14,
      description: 'Pago préstamo: anotación del usuario',
      amount: 7,
      planning_row_kind: 'expense',
    });
    const onlySettled = [settledWallet, settledLenderBatch];

    expect(filterFortnightExpenseTabRows(onlySettled)).toEqual([]);
    expect(countUnpaidFortnightExpenses(onlySettled)).toBe(0);
    expect(shouldShowCashFlowFooter(0)).toBe(false);
    expect(
      visibleFortnightExpenseDateKeys(onlySettled, (item) => item.date),
    ).toEqual([]);

    const view = presentFortnightExpenseTab({
      rows: [expense, settledWallet, userNote],
      totals,
    });
    expect(view.rows.map((item) => item.id)).toEqual([1, 14]);
    expect(view.unpaidCount).toBe(2);
    expect(view.totals).toBe(totals);
    expect(sumCashFlowFooterTotal(view.cashFlowRows)).toBe(167);
    expect(sumCashFlowFooterTotal(view.rows)).toBe(107);
    expect(countUnpaidFortnightExpenses([settledWallet, userNote])).toBe(1);
  });

  it('hides the list, date sections, and footer when only card or loan payments remain', () => {
    const onlyPayments = [cardPayment, walletLoan, payrollLoan];
    const visible = filterFortnightExpenseTabRows(onlyPayments);

    expect(visible).toEqual([]);
    expect(
      visibleFortnightExpenseDateKeys(onlyPayments, (item) => item.date),
    ).toEqual([]);
    expect(shouldShowCashFlowFooter(visible.length)).toBe(false);

    const cardOnlyDate = row({
      id: 10,
      date: '2026-09-16',
      description: 'Pago tarjeta: demo',
      amount: 80,
      planning_row_kind: 'card_payment',
    });
    const expenseOnOtherDate = row({
      id: 11,
      date: '2026-09-14',
      description: 'Pan',
      amount: 12,
    });

    expect(
      visibleFortnightExpenseDateKeys(
        [cardOnlyDate, expenseOnOtherDate, walletLoan],
        (item) => item.date,
      ),
    ).toEqual(['2026-09-14']);
    expect(shouldShowCashFlowFooter(1)).toBe(true);
  });
});
