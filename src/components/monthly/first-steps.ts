/**
 * Primeros pasos: the checklist card at the top of Panel financiero for new
 * accounts. Pure rules only (items, visibility, dismissal storage); the facts
 * come from `loadFirstStepsFacts` on the server.
 */

/** The card is offered only during an account's first 30 days. */
export const FIRST_STEPS_MAX_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Anchor on Panel financiero that wraps the fortnight expenses. */
export const PANEL_EXPENSES_ANCHOR_ID = 'panel-gastos';

export type FirstStepsFacts = {
  userId: number;
  /** First word of the account name, or null when it is empty. */
  firstName: string | null;
  onboardingCompleted: boolean;
  accountCreatedAt: Date;
  /** Any expense marked as paid, personal or in one of the user's houses. */
  hasPaidExpense: boolean;
  /** Any fixed expense (expense template); none means Gastos fijos was skipped. */
  hasExpenseTemplates: boolean;
  /** Any active credit or department-store card wallet. */
  hasCreditCard: boolean;
  /** Another person belongs to one of the user's houses. */
  hasHouseGuest: boolean;
};

export type FirstStepsItemId =
  | 'account'
  | 'paid-expense'
  | 'fixed-expenses'
  | 'credit-card'
  | 'invite';

export type FirstStepsItem = {
  id: FirstStepsItemId;
  label: string;
  done: boolean;
  /** Where the item's action lives; null for the item that is always done. */
  href: string | null;
};

/**
 * The four items, in order. When Gastos fijos was skipped (no templates and
 * nothing paid yet), "Agrega tus gastos fijos" takes the paid-expense slot.
 */
export const buildFirstStepsItems = (
  facts: FirstStepsFacts,
  ownerQuery = '',
): FirstStepsItem[] => {
  const expensesSkipped = !facts.hasExpenseTemplates && !facts.hasPaidExpense;
  const expenseItem: FirstStepsItem = expensesSkipped
    ? {
        id: 'fixed-expenses',
        label: 'Agrega tus gastos fijos',
        done: false,
        href: `/settings/expense-templates${ownerQuery}`,
      }
    : {
        id: 'paid-expense',
        label: 'Marca un gasto como pagado',
        done: facts.hasPaidExpense,
        href: `#${PANEL_EXPENSES_ANCHOR_ID}`,
      };

  return [
    { id: 'account', label: 'Cuenta y quincenas creadas', done: true, href: null },
    expenseItem,
    {
      id: 'credit-card',
      label: 'Agrega tu tarjeta de crédito',
      done: facts.hasCreditCard,
      href: `/credit-cards${ownerQuery}`,
    },
    {
      id: 'invite',
      label: 'Invita a alguien a tu casa',
      done: facts.hasHouseGuest,
      href: '/settings/house-users',
    },
  ];
};

export const countDoneItems = (items: FirstStepsItem[]): number =>
  items.filter((item) => item.done).length;

/**
 * Account is younger than 30 days (a date slightly in the future counts as new:
 * `created_at` is a Mexico City wall-clock timestamp read as UTC, so it can sit
 * up to six hours ahead; that offset does not matter for a 30-day window).
 */
export const isAccountWithinFirstStepsWindow = (
  createdAt: Date,
  now: Date,
): boolean => now.getTime() - createdAt.getTime() < FIRST_STEPS_MAX_AGE_DAYS * DAY_MS;

/**
 * Server half of the rule: onboarding done, account younger than 30 days and
 * at least one item left. Dismissal is checked on the client.
 */
export const isFirstStepsEligible = (
  facts: FirstStepsFacts,
  items: FirstStepsItem[],
  now: Date,
): boolean =>
  facts.onboardingCompleted &&
  isAccountWithinFirstStepsWindow(facts.accountCreatedAt, now) &&
  countDoneItems(items) < items.length;

export const shouldShowFirstSteps = ({
  facts,
  items,
  now,
  dismissed,
}: {
  facts: FirstStepsFacts;
  items: FirstStepsItem[];
  now: Date;
  dismissed: boolean;
}): boolean => !dismissed && isFirstStepsEligible(facts, items, now);

export const firstStepsTitle = (firstName: string | null): string =>
  firstName ? `Tu quincena está lista, ${firstName}` : 'Tu quincena está lista';

export const firstStepsSubtitle = (items: FirstStepsItem[]): string =>
  `Primeros pasos · ${countDoneItems(items)} de ${items.length}`;

export const firstNameOf = (name: string | null | undefined): string | null => {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
};

// --- Dismissal (localStorage, keyed by user id) ---

export type FirstStepsStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const firstStepsDismissKey = (userId: number | string): string =>
  `micasa:first-steps-dismissed:${userId}`;

/** `window.localStorage`, or null when there is none or touching it throws. */
export const getBrowserFirstStepsStorage = (): FirstStepsStorage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
};

/** A storage that throws or is missing reads as not dismissed. */
export const readFirstStepsDismissed = (
  storage: FirstStepsStorage | null,
  userId: number | string,
): boolean => {
  if (!storage) return false;
  try {
    return storage.getItem(firstStepsDismissKey(userId)) === '1';
  } catch {
    return false;
  }
};

/** Returns false when the flag could not be saved (the card still hides for this visit). */
export const writeFirstStepsDismissed = (
  storage: FirstStepsStorage | null,
  userId: number | string,
): boolean => {
  if (!storage) return false;
  try {
    storage.setItem(firstStepsDismissKey(userId), '1');
    return true;
  } catch {
    return false;
  }
};
