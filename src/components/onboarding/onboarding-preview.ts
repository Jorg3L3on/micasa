/**
 * Live "Te queda libre" preview for the onboarding wizard (MIC-I18-3).
 *
 * Pure: no React, no I/O. The aside card, the phone strip and the Resumen step
 * all read the same numbers from `computeOnboardingPreview`.
 */

type WalletLike = {
  type: 'CASH' | 'BANK' | 'CREDIT';
  initialBalance: number;
};

type FortnightItemLike = {
  amount: number;
  appliesFirstFortnight: boolean;
  appliesSecondFortnight: boolean;
};

export type OnboardingPreviewInput = {
  wallets: readonly WalletLike[];
  incomeTemplates: readonly FortnightItemLike[];
  expenseTemplates: readonly FortnightItemLike[];
};

export type QuincenaPreview = {
  /** Income that lands in this quincena. */
  income: number;
  /** Fixed costs paid in this quincena. */
  fixedCosts: number;
  /** `income - fixedCosts`; negative when costs are above income. */
  free: number;
  /**
   * Fixed costs as a whole percent of income (can pass 100).
   * `null` when the quincena has no income.
   */
  percentCommitted: number | null;
};

export type OnboardingPreview = {
  /** Cash plus debit balances today. Credit lines are not money you have. */
  balanceToday: number;
  /** At least one income with an amount lands in a quincena. */
  hasIncome: boolean;
  /** At least one fixed cost with an amount lands in a quincena. */
  hasFixedCosts: boolean;
  first: QuincenaPreview;
  second: QuincenaPreview;
};

/** Drafts without a usable amount (empty, NaN, Infinity) count as 0. */
const amountOf = (value: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/** Round to cents so float sums never show a long binary-fraction tail. */
const toCents = (value: number): number => Math.round(value * 100) / 100;

const sumFor = (
  items: readonly FortnightItemLike[],
  fortnight: 'first' | 'second',
): number =>
  toCents(
    items.reduce((total, item) => {
      const applies =
        fortnight === 'first'
          ? item.appliesFirstFortnight
          : item.appliesSecondFortnight;
      return applies ? total + amountOf(item.amount) : total;
    }, 0),
  );

const quincena = (income: number, fixedCosts: number): QuincenaPreview => ({
  income,
  fixedCosts,
  free: toCents(income - fixedCosts),
  percentCommitted: income > 0 ? Math.round((fixedCosts / income) * 100) : null,
});

export const computeOnboardingPreview = ({
  wallets,
  incomeTemplates,
  expenseTemplates,
}: OnboardingPreviewInput): OnboardingPreview => {
  const balanceToday = toCents(
    wallets.reduce(
      (total, wallet) =>
        wallet.type === 'CREDIT' ? total : total + amountOf(wallet.initialBalance),
      0,
    ),
  );

  const first = quincena(
    sumFor(incomeTemplates, 'first'),
    sumFor(expenseTemplates, 'first'),
  );
  const second = quincena(
    sumFor(incomeTemplates, 'second'),
    sumFor(expenseTemplates, 'second'),
  );

  return {
    balanceToday,
    hasIncome: first.income > 0 || second.income > 0,
    hasFixedCosts: first.fixedCosts > 0 || second.fixedCosts > 0,
    first,
    second,
  };
};

/** Bar width for a quincena: percent committed, clamped to 0–100. */
export const committedBarPercent = (preview: QuincenaPreview): number =>
  preview.percentCommitted === null
    ? preview.fixedCosts > 0
      ? 100
      : 0
    : Math.min(100, Math.max(0, preview.percentCommitted));
