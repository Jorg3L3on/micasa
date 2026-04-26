'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type WalletDraft = {
  id: string;
  name: string;
  type: 'CASH' | 'BANK' | 'CREDIT';
  providerIconKey: string | null;
};

export type CategoryDraft = {
  id: string;
  name: string;
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
  categories: CategoryDraft[];
  setCategories: React.Dispatch<React.SetStateAction<CategoryDraft[]>>;
  incomeTemplates: IncomeTemplateDraft[];
  setIncomeTemplates: React.Dispatch<
    React.SetStateAction<IncomeTemplateDraft[]>
  >;
  expenseTemplates: ExpenseTemplateDraft[];
  setExpenseTemplates: React.Dispatch<
    React.SetStateAction<ExpenseTemplateDraft[]>
  >;
  startDate: string | null;
  setStartDate: (value: string | null) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const TOTAL_STEPS = 6;

const getCurrentMonthFirstDayIso = (): string => {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  firstOfMonth.setHours(0, 0, 0, 0);
  return firstOfMonth.toISOString().slice(0, 10);
};

type OnboardingProviderProps = {
  children: ReactNode;
};

export const OnboardingProvider = ({ children }: OnboardingProviderProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isStepLoading, setStepLoading] = useState(false);
  const [canProceed, setCanProceed] = useState(true);
  const [wallets, setWallets] = useState<WalletDraft[]>([
    { id: crypto.randomUUID(), name: '', type: 'CASH', providerIconKey: 'CASH_GENERIC' },
    { id: crypto.randomUUID(), name: '', type: 'BANK', providerIconKey: null },
  ]);
  const [categories, setCategories] = useState<CategoryDraft[]>([
    { id: crypto.randomUUID(), name: 'Comida' },
    { id: crypto.randomUUID(), name: 'Transporte' },
    { id: crypto.randomUUID(), name: 'Vivienda' },
  ]);
  const [incomeTemplates, setIncomeTemplates] = useState<IncomeTemplateDraft[]>(
    [
      {
        id: crypto.randomUUID(),
        name: 'Sueldo',
        amount: 0,
        walletId: '',
        source: '',
        appliesFirstFortnight: true,
        appliesSecondFortnight: true,
      },
    ],
  );
  const [expenseTemplates, setExpenseTemplates] = useState<
    ExpenseTemplateDraft[]
  >([
    {
      id: crypto.randomUUID(),
      name: 'Renta',
      amount: 0,
      categoryId: '',
      walletId: '',
      isRecurring: true,
      appliesFirstFortnight: true,
      appliesSecondFortnight: true,
    },
    {
      id: crypto.randomUUID(),
      name: 'Internet',
      amount: 0,
      categoryId: '',
      walletId: '',
      isRecurring: true,
      appliesFirstFortnight: true,
      appliesSecondFortnight: true,
    },
  ]);
  const [startDate, setStartDate] = useState<string | null>(getCurrentMonthFirstDayIso);

  const goNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS - 1));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      currentStep,
      totalSteps: TOTAL_STEPS,
      goNext,
      goBack,
      isFirstStep: currentStep === 0,
      isLastStep: currentStep === TOTAL_STEPS - 1,
      isStepLoading,
      setStepLoading,
      canProceed,
      setCanProceed,
      wallets,
      setWallets,
      categories,
      setCategories,
      incomeTemplates,
      setIncomeTemplates,
      expenseTemplates,
      setExpenseTemplates,
      startDate,
      setStartDate,
    }),
    [
      currentStep,
      goNext,
      goBack,
      isStepLoading,
      canProceed,
      wallets,
      categories,
      incomeTemplates,
      expenseTemplates,
      startDate,
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
