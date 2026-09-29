/**
 * Page → create-action map for the header / dock "+".
 *
 * The control is icon-only (pre-JOR-304 glass icon). `label` is the
 * aria-label and tooltip, not visible button text.
 * Routes without their own alta fall back to gasto o ingreso.
 */

export type PageCreateKind =
  | 'wallet'
  | 'wallet-movement'
  | 'loan'
  | 'goal'
  | 'goal-save'
  | 'budget'
  | 'category'
  | 'expense-template'
  | 'income-template'
  | 'card-purchase'
  | 'connection'
  | 'invite'
  | 'expense'
  | 'income'
  | 'expense-or-income';

export type PageCreateAction = {
  kind: PageCreateKind;
  label: string;
};

export const PAGE_CREATE_ACTION = {
  wallet: {
    kind: 'wallet',
    label: 'Agregar billetera o tarjeta',
  },
  walletMovement: {
    kind: 'wallet-movement',
    label: 'Agregar movimiento',
  },
  loan: {
    kind: 'loan',
    label: 'Agregar préstamo',
  },
  goal: {
    kind: 'goal',
    label: 'Agregar meta',
  },
  goalSave: {
    kind: 'goal-save',
    label: 'Ahorrar',
  },
  budget: {
    kind: 'budget',
    label: 'Agregar presupuesto',
  },
  category: {
    kind: 'category',
    label: 'Agregar categoría',
  },
  expenseTemplate: {
    kind: 'expense-template',
    label: 'Agregar plantilla de gasto',
  },
  incomeTemplate: {
    kind: 'income-template',
    label: 'Agregar plantilla de ingreso',
  },
  cardPurchase: {
    kind: 'card-purchase',
    label: 'Agregar compra',
  },
  connection: {
    kind: 'connection',
    label: 'Agregar conexión',
  },
  invite: {
    kind: 'invite',
    label: 'Invitar usuario',
  },
  expense: {
    kind: 'expense',
    label: 'Agregar gasto',
  },
  income: {
    kind: 'income',
    label: 'Agregar ingreso',
  },
  expenseOrIncome: {
    kind: 'expense-or-income',
    label: 'Agregar gasto o ingreso',
  },
} as const satisfies Record<string, PageCreateAction>;

export type TransactionTypeFilter = string | null | undefined;

/** Operaciones: the type filter picks gasto, ingreso, or the chooser. */
export const resolveTransactionCreateAction = (
  type: TransactionTypeFilter,
): PageCreateAction => {
  if (type === 'expense') return PAGE_CREATE_ACTION.expense;
  if (type === 'income') return PAGE_CREATE_ACTION.income;
  return PAGE_CREATE_ACTION.expenseOrIncome;
};

const normalizePath = (pathname: string): string => {
  const path = pathname.split('?')[0]?.replace(/\/+$/, '') ?? '';
  return path.length > 0 ? path : '/';
};

/**
 * Own alta for a route. Detail routes describe the action when that
 * screen can register it (funding wallet, active goal, house owner).
 * When the screen cannot, chrome falls back to gasto o ingreso.
 */
export const resolvePageCreateAction = (
  pathname: string,
  options?: { transactionType?: TransactionTypeFilter },
): PageCreateAction => {
  const path = normalizePath(pathname);

  if (path === '/wallets' || path === '/credit-cards') {
    return PAGE_CREATE_ACTION.wallet;
  }
  if (path === '/wallets/liquidity') {
    return PAGE_CREATE_ACTION.expenseOrIncome;
  }
  if (/^\/wallets\/[^/]+$/.test(path)) {
    return PAGE_CREATE_ACTION.walletMovement;
  }
  if (/^\/credit-cards\/[^/]+$/.test(path)) {
    return PAGE_CREATE_ACTION.cardPurchase;
  }
  if (path === '/loans') return PAGE_CREATE_ACTION.loan;
  if (path === '/metas') return PAGE_CREATE_ACTION.goal;
  if (/^\/metas\/[^/]+$/.test(path)) return PAGE_CREATE_ACTION.goalSave;
  if (path === '/settings/budgets') return PAGE_CREATE_ACTION.budget;
  if (path === '/settings/categories') return PAGE_CREATE_ACTION.category;
  if (path === '/settings/expense-templates') {
    return PAGE_CREATE_ACTION.expenseTemplate;
  }
  if (path === '/settings/income-templates') {
    return PAGE_CREATE_ACTION.incomeTemplate;
  }
  if (path === '/settings/connections') return PAGE_CREATE_ACTION.connection;
  if (path === '/settings/house-users') return PAGE_CREATE_ACTION.invite;
  if (path === '/transactions') {
    return resolveTransactionCreateAction(options?.transactionType);
  }

  return PAGE_CREATE_ACTION.expenseOrIncome;
};
