import type {
  ExpenseTemplateDraft,
  IncomeTemplateDraft,
  WalletDraft,
} from '@/components/onboarding/OnboardingContext';

/**
 * Onboarding draft kept in the browser so a reload or a closed tab resumes
 * where the user left off. One entry per user id, so two people sharing a
 * browser never see each other's draft. Every storage call is guarded: a
 * missing or throwing storage (private mode, quota, disabled cookies) only
 * means the draft is not kept.
 */

export const ONBOARDING_DRAFT_VERSION = 1;

const KEY_PREFIX = 'micasa:onboarding-draft';

export type OnboardingDraft = {
  version: typeof ONBOARDING_DRAFT_VERSION;
  /** Internal step index (0 = Billeteras … 3 = Resumen). */
  step: number;
  wallets: WalletDraft[];
  incomeTemplates: IncomeTemplateDraft[];
  expenseTemplates: ExpenseTemplateDraft[];
};

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const onboardingDraftKey = (userId: string): string =>
  `${KEY_PREFIX}:v${ONBOARDING_DRAFT_VERSION}:${userId}`;

/** `window.localStorage`, or null when there is none or reading it throws. */
export const getBrowserDraftStorage = (): DraftStorage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
};

const isObjectArray = (value: unknown): value is Record<string, unknown>[] =>
  Array.isArray(value) &&
  value.every((item) => typeof item === 'object' && item !== null);

const hasStringId = (items: Record<string, unknown>[]): boolean =>
  items.every((item) => typeof item.id === 'string');

export const saveOnboardingDraft = (
  storage: DraftStorage | null,
  userId: string,
  draft: Omit<OnboardingDraft, 'version'>,
): boolean => {
  if (!storage || !userId) return false;
  try {
    const value: OnboardingDraft = { version: ONBOARDING_DRAFT_VERSION, ...draft };
    storage.setItem(onboardingDraftKey(userId), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

/** The saved draft for this user, or null when there is none or it is unreadable. */
export const loadOnboardingDraft = (
  storage: DraftStorage | null,
  userId: string,
  totalSteps: number,
): OnboardingDraft | null => {
  if (!storage || !userId) return null;
  try {
    const raw = storage.getItem(onboardingDraftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingDraft> | null;
    if (!parsed || parsed.version !== ONBOARDING_DRAFT_VERSION) return null;
    const { step, wallets, incomeTemplates, expenseTemplates } = parsed;
    if (
      typeof step !== 'number' ||
      !Number.isInteger(step) ||
      !isObjectArray(wallets) ||
      !isObjectArray(incomeTemplates) ||
      !isObjectArray(expenseTemplates) ||
      !hasStringId(wallets) ||
      !hasStringId(incomeTemplates) ||
      !hasStringId(expenseTemplates)
    ) {
      return null;
    }
    return {
      version: ONBOARDING_DRAFT_VERSION,
      step: Math.min(Math.max(step, 0), totalSteps - 1),
      wallets: wallets as WalletDraft[],
      incomeTemplates: incomeTemplates as IncomeTemplateDraft[],
      expenseTemplates: expenseTemplates as ExpenseTemplateDraft[],
    };
  } catch {
    return null;
  }
};

export const clearOnboardingDraft = (
  storage: DraftStorage | null,
  userId: string,
): void => {
  if (!storage || !userId) return;
  try {
    storage.removeItem(onboardingDraftKey(userId));
  } catch {
    // Nothing to do: the draft simply stays until the browser drops it.
  }
};
