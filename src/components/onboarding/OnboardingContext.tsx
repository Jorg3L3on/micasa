'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createClientId } from '@/lib/polyfills';
import { todayCalendarDate } from '@/lib/calendar-dates';

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
  startDate: string;
  /** Wallet that new incomes and expenses default to (first debit wallet). */
  defaultWalletId: string;
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
  children: ReactNode;
};

export const OnboardingProvider = ({ children }: OnboardingProviderProps) => {
  const [initial] = useState(createInitialDraft);
  const [currentStep, setCurrentStep] = useState(0);
  const [isStepLoading, setStepLoading] = useState(false);
  const [canProceed, setCanProceed] = useState(true);
  const [wallets, setWallets] = useState<WalletDraft[]>(initial.wallets);
  const [incomeTemplates, setIncomeTemplates] = useState<IncomeTemplateDraft[]>(
    initial.incomeTemplates,
  );
  const [expenseTemplates, setExpenseTemplates] = useState<
    ExpenseTemplateDraft[]
  >([]);
  const [startDate] = useState(currentMonthStart);

  const defaultWalletId =
    wallets.find((wallet) => wallet.type === 'BANK')?.id ??
    wallets.find((wallet) => wallet.type === 'CASH')?.id ??
    wallets[0]?.id ??
    '';

  const goNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, ONBOARDING_TOTAL_STEPS - 1));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      currentStep,
      totalSteps: ONBOARDING_TOTAL_STEPS,
      goNext,
      goBack,
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
      startDate,
      defaultWalletId,
    }),
    [
      currentStep,
      goNext,
      goBack,
      isStepLoading,
      canProceed,
      wallets,
      incomeTemplates,
      expenseTemplates,
      startDate,
      defaultWalletId,
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
