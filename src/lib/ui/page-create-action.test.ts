import { describe, expect, it } from 'vitest';
import {
  PAGE_CREATE_ACTION,
  resolvePageCreateAction,
  resolveTransactionCreateAction,
} from '@/lib/ui/page-create-action';

describe('resolvePageCreateAction', () => {
  it('maps each collection to its own alta', () => {
    expect(resolvePageCreateAction('/wallets')).toEqual(PAGE_CREATE_ACTION.wallet);
    expect(resolvePageCreateAction('/credit-cards')).toEqual(
      PAGE_CREATE_ACTION.wallet,
    );
    expect(resolvePageCreateAction('/loans')).toEqual(PAGE_CREATE_ACTION.loan);
    expect(resolvePageCreateAction('/metas')).toEqual(PAGE_CREATE_ACTION.goal);
    expect(resolvePageCreateAction('/settings/budgets')).toEqual(
      PAGE_CREATE_ACTION.budget,
    );
    expect(resolvePageCreateAction('/settings/categories')).toEqual(
      PAGE_CREATE_ACTION.category,
    );
    expect(resolvePageCreateAction('/settings/expense-templates')).toEqual(
      PAGE_CREATE_ACTION.expenseTemplate,
    );
    expect(resolvePageCreateAction('/settings/income-templates')).toEqual(
      PAGE_CREATE_ACTION.incomeTemplate,
    );
    expect(resolvePageCreateAction('/settings/connections')).toEqual(
      PAGE_CREATE_ACTION.connection,
    );
    expect(resolvePageCreateAction('/settings/house-users')).toEqual(
      PAGE_CREATE_ACTION.invite,
    );
  });

  it('maps detail routes to the object action', () => {
    expect(resolvePageCreateAction('/wallets/12')).toEqual(
      PAGE_CREATE_ACTION.walletMovement,
    );
    expect(resolvePageCreateAction('/credit-cards/4')).toEqual(
      PAGE_CREATE_ACTION.cardPurchase,
    );
    expect(resolvePageCreateAction('/metas/9')).toEqual(
      PAGE_CREATE_ACTION.goalSave,
    );
  });

  it('uses gasto o ingreso where the page has no alta of its own', () => {
    const fallback = PAGE_CREATE_ACTION.expenseOrIncome;
    expect(resolvePageCreateAction('/monthly/2026/9')).toEqual(fallback);
    expect(resolvePageCreateAction('/fortnight/2026/9/FIRST')).toEqual(
      fallback,
    );
    expect(resolvePageCreateAction('/wallets/liquidity')).toEqual(fallback);
    expect(resolvePageCreateAction('/settings/account')).toEqual(fallback);
    expect(resolvePageCreateAction('/settings/expense-templates/new')).toEqual(
      fallback,
    );
    expect(resolvePageCreateAction('/transactions')).toEqual(fallback);
  });

  it('splits Operaciones by the type filter', () => {
    expect(resolveTransactionCreateAction('expense')).toEqual(
      PAGE_CREATE_ACTION.expense,
    );
    expect(resolveTransactionCreateAction('income')).toEqual(
      PAGE_CREATE_ACTION.income,
    );
    expect(resolveTransactionCreateAction(null)).toEqual(
      PAGE_CREATE_ACTION.expenseOrIncome,
    );
    expect(
      resolvePageCreateAction('/transactions', { transactionType: 'expense' }),
    ).toEqual(PAGE_CREATE_ACTION.expense);
    expect(
      resolvePageCreateAction('/transactions/', { transactionType: 'income' }),
    ).toEqual(PAGE_CREATE_ACTION.income);
  });

  it('ignores a query string on the pathname', () => {
    expect(resolvePageCreateAction('/metas?ownerType=house&ownerId=1')).toEqual(
      PAGE_CREATE_ACTION.goal,
    );
  });
});
