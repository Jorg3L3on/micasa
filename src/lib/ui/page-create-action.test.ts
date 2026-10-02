import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PAGE_CREATE_ACTION,
  resolvePageCreateAction,
  resolveTransactionCreateAction,
} from '@/lib/ui/page-create-action';

const SRC = resolve(process.cwd(), 'src');
const TRANSACTION_REGISTRATION = 'src/components/TransactionsDataTable.tsx';

type ActionKey = keyof typeof PAGE_CREATE_ACTION;

/** Real `useRegisterToolbarActions` sites and the route the map must agree with. */
const PAGE_REGISTRATIONS: {
  file: string;
  route: string;
  key: ActionKey;
}[] = [
  { file: 'src/app/(app)/wallets/page.tsx', route: '/wallets', key: 'wallet' },
  {
    file: 'src/app/(app)/wallets/[id]/page.tsx',
    route: '/wallets/12',
    key: 'walletMovement',
  },
  { file: 'src/app/(app)/loans/page.tsx', route: '/loans', key: 'loan' },
  { file: 'src/app/(app)/settings/metas/page.tsx', route: '/settings/metas', key: 'goal' },
  {
    file: 'src/app/(app)/settings/metas/[id]/page.tsx',
    route: '/settings/metas/9',
    key: 'goalSave',
  },
  {
    file: 'src/app/(app)/settings/budgets/page.tsx',
    route: '/settings/budgets',
    key: 'budget',
  },
  {
    file: 'src/app/(app)/settings/categories/page.tsx',
    route: '/settings/categories',
    key: 'category',
  },
  {
    file: 'src/app/(app)/settings/expense-templates/page.tsx',
    route: '/settings/expense-templates',
    key: 'expenseTemplate',
  },
  {
    file: 'src/app/(app)/settings/income-templates/page.tsx',
    route: '/settings/income-templates',
    key: 'incomeTemplate',
  },
  {
    file: 'src/app/(app)/credit-cards/[id]/page.tsx',
    route: '/credit-cards/4',
    key: 'cardPurchase',
  },
  {
    file: 'src/components/settings/ConnectionsPanel.tsx',
    route: '/settings/connections',
    key: 'connection',
  },
  {
    file: 'src/app/(app)/settings/house-users/page.tsx',
    route: '/settings/house-users',
    key: 'invite',
  },
  {
    file: 'src/components/monthly/MonthlyPanelLayout.tsx',
    route: '/monthly/2026/9',
    key: 'expenseOrIncome',
  },
];

const collectSources = (dir: string, out: string[]) => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'generated') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSources(full, out);
      continue;
    }
    if (/\.(tsx|ts)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
};

const extractRegistrationCall = (source: string): string | null => {
  const marker = 'useRegisterToolbarActions(';
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const open = start + marker.length - 1;
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') depth += 1;
    else if (char === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return null;
};

describe('resolvePageCreateAction', () => {
  it('maps each collection to its own alta', () => {
    expect(resolvePageCreateAction('/wallets')).toEqual(PAGE_CREATE_ACTION.wallet);
    expect(resolvePageCreateAction('/credit-cards')).toEqual(
      PAGE_CREATE_ACTION.wallet,
    );
    expect(resolvePageCreateAction('/loans')).toEqual(PAGE_CREATE_ACTION.loan);
    expect(resolvePageCreateAction('/settings/metas')).toEqual(PAGE_CREATE_ACTION.goal);
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
    expect(resolvePageCreateAction('/settings/metas/9')).toEqual(
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
    expect(resolvePageCreateAction('/settings/metas?ownerType=house&ownerId=1')).toEqual(
      PAGE_CREATE_ACTION.goal,
    );
  });
});

describe('page create registrations match the map', () => {
  it('covers every useRegisterToolbarActions call site', () => {
    const files: string[] = [];
    collectSources(SRC, files);
    const callers = files
      .map((file) => relative(process.cwd(), file))
      .filter((file) => file !== 'src/context/toolbar-actions-context.tsx')
      .filter((file) =>
        readFileSync(resolve(process.cwd(), file), 'utf8').includes(
          'useRegisterToolbarActions(',
        ),
      )
      .sort();
    const expected = [
      ...PAGE_REGISTRATIONS.map((item) => item.file),
      TRANSACTION_REGISTRATION,
    ].sort();
    expect(callers).toEqual(expected);
  });

  it('registers each page with the action the map resolves for that route', () => {
    for (const item of PAGE_REGISTRATIONS) {
      const source = readFileSync(resolve(process.cwd(), item.file), 'utf8');
      const call = extractRegistrationCall(source);
      const keys = [
        ...String(call).matchAll(/PAGE_CREATE_ACTION\.(\w+)\.label/g),
      ].map((match) => match[1]);
      expect(keys, item.file).toEqual([item.key]);
      expect(resolvePageCreateAction(item.route), item.file).toEqual(
        PAGE_CREATE_ACTION[item.key],
      );
    }
  });

  it('registers Operaciones through the transaction resolver', () => {
    const source = readFileSync(
      resolve(process.cwd(), TRANSACTION_REGISTRATION),
      'utf8',
    );
    const call = extractRegistrationCall(source);
    expect(call).toContain('label: transactionCreate.label');
    expect(source).toContain('resolveTransactionCreateAction(');
    expect(resolvePageCreateAction('/transactions')).toEqual(
      resolveTransactionCreateAction(null),
    );
    expect(
      resolvePageCreateAction('/transactions', { transactionType: 'expense' }),
    ).toEqual(resolveTransactionCreateAction('expense'));
    expect(
      resolvePageCreateAction('/transactions', { transactionType: 'income' }),
    ).toEqual(resolveTransactionCreateAction('income'));
  });
});
