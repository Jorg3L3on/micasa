'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createClientId } from '@/lib/polyfills';
import type { CategoryOption } from '@/types/catalog';
import { todayCalendarDate } from '@/lib/calendar-dates';
import {
  clearOnboardingDraft,
  getBrowserDraftStorage,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from '@/components/onboarding/onboarding-draft-storage';
import {
  navBack,
  navGoTo,
  navNext,
  type OnboardingNavState,
} from '@/components/onboarding/onboarding-navigation';

export type WalletDraftType = 'CASH' | 'BANK' | 'CREDIT';

export type WalletDraft = {
  id: string;
  name: string;
  type: WalletDraftType;
  providerIconKey: string | null;
  /** Current balance (CASH / BANK). Optional; 0 when unknown. */
  initialBalance: number;
  /** CREDIT only: line of credit (> 0) and statement days (1–31). */
  creditLimit: number;
  cutoffDay: number | null;
  dueDay: number | null;
};

export type IncomeTemplateDraft = {
  id: string;
  name: string;
  amount: number;
  walletId: string;
  source: string;
  appliesFirstFortnight: boolean;
  appliesSecondFortnight: boolean;
};

export type ExpenseTemplateDraft = {
  id: string;
  name: string;
  amount: number;
  /** Persisted category id (stringified number from API). */
  categoryId: string;
  walletId: string;
  isRecurring: boolean;
  appliesFirstFortnight: boolean;
  appliesSecondFortnight: boolean;
};

type OnboardingContextValue = {
  currentStep: number;
  totalSteps: number;
  goNext: () => void;
  goBack: () => void;
  /** Jump to a step; `returnHere` makes its Continuar come back to the current step. */
  goToStep: (step: number, options?: { returnHere?: boolean }) => void;
  /** Step that Continuar returns to after an Editar jump; `null` otherwise. */
  returnStep: number | null;
  isFirstStep: boolean;
  isLastStep: boolean;
  isStepLoading: boolean;
  setStepLoading: (loading: boolean) => void;
  canProceed: boolean;
  setCanProceed: (value: boolean) => void;
  wallets: WalletDraft[];
  setWallets: React.Dispatch<React.SetStateAction<WalletDraft[]>>;
  incomeTemplates: IncomeTemplateDraft[];
  setIncomeTemplates: React.Dispatch<
    React.SetStateAction<IncomeTemplateDraft[]>
  >;
  expenseTemplates: ExpenseTemplateDraft[];
  setExpenseTemplates: React.Dispatch<
    React.SetStateAction<ExpenseTemplateDraft[]>
  >;
  /** Categories for Gastos fijos; `null` until loaded once, then kept between steps. */
  categories: CategoryOption[] | null;
  setCategories: (categories: CategoryOption[]) => void;
  startDate: string;
  /** Wallet that new incomes and expenses default to (first debit wallet). */
  defaultWalletId: string;
  /** False until the saved draft (if any) has been read on mount. */
  isDraftReady: boolean;
  /** Drop the saved draft and stop saving (call after onboarding completes). */
  clearDraft: () => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** Billeteras → Ingresos → Gastos → Resumen (categories are seeded at register). */
export const ONBOARDING_TOTAL_STEPS = 4;

export const WALLET_TYPE_LABEL: Record<WalletDraftType, string> = {
  CASH: 'Efectivo',
  BANK: 'Tarjeta de débito',
  CREDIT: 'Tarjeta de crédito',
};

export const createWalletDraft = (
  type: WalletDraftType,
  name = '',
): WalletDraft => ({
  id: createClientId(),
  name,
  type,
  providerIconKey: type === 'CASH' ? 'CASH_GENERIC' : null,
  initialBalance: 0,
  creditLimit: 0,
  cutoffDay: null,
  dueDay: null,
});

/** First day of the current month in Mexico City (`YYYY-MM-01`). */
const currentMonthStart = (): string => `${todayCalendarDate().slice(0, 7)}-01`;

type InitialDraft = {
  wallets: WalletDraft[];
  incomeTemplates: IncomeTemplateDraft[];
};

/** The two required wallets and the salary arrive pre-filled. */
const createInitialDraft = (): InitialDraft => {
  const cash = createWalletDraft('CASH', 'Efectivo');
  const debit = createWalletDraft('BANK', 'Cuenta de débito');
  return {
    wallets: [cash, debit],
    incomeTemplates: [
      {
        id: createClientId(),
        name: 'Sueldo',
        amount: 0,
        walletId: debit.id,
        source: '',
        appliesFirstFortnight: true,
        appliesSecondFortnight: true,
      },
    ],
  };
};

type OnboardingProviderProps = {
  /** Session user id; scopes the saved draft so users on one browser never share it. */
  userId: string;
  children: ReactNode;
};

const subscribeNothing = () => () => {};

/**
 * Renders defaults on the server and during hydration, then remounts the state
 * once on the client so the saved draft is read in the initial state (no
 * effect-driven overwrite, no hydration mismatch).
 */
export const OnboardingProvider = ({
  userId,
  children,
}: OnboardingProviderProps) => {
  const isClient = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  return (
    <OnboardingStateProvider
      key={isClient ? `client:${userId}` : 'server'}
      userId={userId}
      isDraftReady={isClient}
    >
      {children}
    </OnboardingStateProvider>
  );
};

type StartingState = InitialDraft & {
  step: number;
  expenseTemplates: ExpenseTemplateDraft[];
};

const readStartingState = (
  userId: string,
  isDraftReady: boolean,
): StartingState => {
  const saved = isDraftReady
    ? loadOnboardingDraft(getBrowserDraftStorage(), userId, ONBOARDING_TOTAL_STEPS)
    : null;
  if (saved) {
    return {
      step: saved.step,
      wallets: saved.wallets,
      incomeTemplates: saved.incomeTemplates,
      expenseTemplates: saved.expenseTemplates,
    };
  }
  return { step: 0, expenseTemplates: [], ...createInitialDraft() };
};

const OnboardingStateProvider = ({
  userId,
  isDraftReady,
  children,
}: OnboardingProviderProps & { isDraftReady: boolean }) => {
  const [initial] = useState(() => readStartingState(userId, isDraftReady));
  const [nav, setNav] = useState<OnboardingNavState>({
    step: initial.step,
    returnStep: null,
  });
  const currentStep = nav.step;
  const returnStep = nav.returnStep;
  const [isStepLoading, setStepLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[] | null>(null);
  const [canProceed, setCanProceed] = useState(true);
  const [wallets, setWallets] = useState<WalletDraft[]>(initial.wallets);
  const [incomeTemplates, setIncomeTemplates] = useState<IncomeTemplateDraft[]>(
    initial.incomeTemplates,
  );
  const [expenseTemplates, setExpenseTemplates] = useState<
    ExpenseTemplateDraft[]
  >(initial.expenseTemplates);
  const [startDate] = useState(currentMonthStart);
  const draftClearedRef = useRef(false);

  // Save on every change (client only), so a reload resumes here.
  useEffect(() => {
    if (!isDraftReady || draftClearedRef.current) return;
    saveOnboardingDraft(getBrowserDraftStorage(), userId, {
      step: currentStep,
      wallets,
      incomeTemplates,
      expenseTemplates,
    });
  }, [
    isDraftReady,
    userId,
    currentStep,
    wallets,
    incomeTemplates,
    expenseTemplates,
  ]);

  const clearDraft = useCallback(() => {
    draftClearedRef.current = true;
    clearOnboardingDraft(getBrowserDraftStorage(), userId);
  }, [userId]);

  const defaultWalletId =
    wallets.find((wallet) => wallet.type === 'BANK')?.id ??
    wallets.find((wallet) => wallet.type === 'CASH')?.id ??
    wallets[0]?.id ??
    '';

  const goNext = useCallback(() => {
    setNav((prev) => navNext(prev, ONBOARDING_TOTAL_STEPS));
  }, []);

  const goBack = useCallback(() => {
    setNav(navBack);
  }, []);

  const goToStep = useCallback(
    (step: number, options?: { returnHere?: boolean }) => {
      setNav((prev) => navGoTo(prev, step, ONBOARDING_TOTAL_STEPS, options));
    },
    [],
  );

  const value = useMemo<OnboardingContextValue>(
    () => ({
      currentStep,
      totalSteps: ONBOARDING_TOTAL_STEPS,
      goNext,
      goBack,
      goToStep,
      returnStep,
      isFirstStep: currentStep === 0,
      isLastStep: currentStep === ONBOARDING_TOTAL_STEPS - 1,
      isStepLoading,
      setStepLoading,
      canProceed,
      setCanProceed,
      wallets,
      setWallets,
      incomeTemplates,
      setIncomeTemplates,
      expenseTemplates,
      setExpenseTemplates,
      categories,
      setCategories,
      startDate,
      defaultWalletId,
      isDraftReady,
      clearDraft,
    }),
    [
      currentStep,
      goNext,
      goBack,
      goToStep,
      returnStep,
      isStepLoading,
      canProceed,
      wallets,
      incomeTemplates,
      expenseTemplates,
      categories,
      startDate,
      defaultWalletId,
      isDraftReady,
      clearDraft,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingContextValue => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return ctx;
};
