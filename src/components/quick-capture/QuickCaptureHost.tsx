'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { QuickCaptureChooser } from '@/components/quick-capture/QuickCaptureChooser';
import { QuickExpenseSheet } from '@/components/quick-capture/QuickExpenseSheet';
import { QuickIncomeSheet } from '@/components/quick-capture/QuickIncomeSheet';
import { createPlannedIncome } from '@/lib/api/incomes';
import type {
  QuickExpenseFormValues,
  QuickIncomeFormValues,
} from '@/schemas/transaction.schema';
import {
  MonthlyPanelRefreshProvider,
  MonthlyPanelRefreshRegisterProvider,
} from '@/components/monthly/monthly-panel-refresh';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

type QuickCaptureContextValue = {
  open: () => void;
  openExpense: () => void;
  openIncome: () => void;
};

const QuickCaptureContext = createContext<QuickCaptureContextValue | null>(
  null,
);

export function useQuickCapture(): QuickCaptureContextValue {
  const ctx = useContext(QuickCaptureContext);
  if (!ctx) {
    throw new Error('useQuickCapture must be used within QuickCaptureHost');
  }
  return ctx;
}

/** Safe for header toolbar when host may not have mounted yet. */
export function useOptionalQuickCapture(): QuickCaptureContextValue | null {
  return useContext(QuickCaptureContext);
}

type QuickCaptureHostProps = {
  children?: ReactNode;
};

/**
 * Provides quick-expense open API and overlay.
 * Mount once under the authenticated app shell.
 */
export function QuickCaptureHost({ children }: QuickCaptureHostProps) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const router = useRouter();
  const { context } = useFinanceContext();
  const panelRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const registerPanelRefresh = useCallback(
    (refresh: (() => Promise<void>) | null) => {
      panelRefreshRef.current = refresh;
    },
    [],
  );

  const refreshAfterMutation = useCallback(async () => {
    const refresh = panelRefreshRef.current;
    if (!refresh) {
      router.refresh();
      return;
    }
    try {
      await refresh();
    } catch (error) {
      console.error('Error refreshing panel data:', error);
    }
  }, [router]);

  const refreshPanel = useCallback(async () => {
    const refresh = panelRefreshRef.current;
    if (!refresh) return;
    await refresh();
  }, []);

  const open = useCallback(() => {
    setExpenseError(null);
    setIncomeError(null);
    setChooserOpen(true);
  }, []);

  const openExpense = useCallback(() => {
    setExpenseError(null);
    setChooserOpen(false);
    setExpenseOpen(true);
  }, []);

  const openIncome = useCallback(() => {
    setIncomeError(null);
    setChooserOpen(false);
    setIncomeOpen(true);
  }, []);

  const value = useMemo(
    () => ({ open, openExpense, openIncome }),
    [open, openExpense, openIncome],
  );

  const handleSaveExpense = async (values: QuickExpenseFormValues) => {
    setExpenseError(null);
    try {
      await clientFetchFromApi(
        '/api/expenses',
        {
          method: 'POST',
          body: JSON.stringify({
            name: values.name,
            categoryId: values.categoryId,
            amount: values.amount,
            paymentMethodId: values.paymentMethodId,
            date: values.date,
            isPaid: values.isPaid,
            isRecurring: false,
            applyToBothFortnights: false,
            applyWalletDelta: values.isPaid
              ? values.applyWalletDelta
              : undefined,
          }),
        },
        context,
      );
      setExpenseOpen(false);
      toast.success(values.isPaid ? 'Gasto registrado' : 'Gasto planificado');
      await refreshAfterMutation();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo guardar el gasto';
      setExpenseError(message);
      throw err;
    }
  };

  const handleSaveIncome = async (values: QuickIncomeFormValues) => {
    setIncomeError(null);
    if (values.paymentMethodId == null) {
      setIncomeError('Selecciona la billetera de efectivo o débito');
      return;
    }
    try {
      await createPlannedIncome(
        {
          amount: values.amount,
          source: values.name,
          received_at: values.date,
          category_id: values.categoryId,
          wallet_id: values.paymentMethodId,
        },
        context,
      );
      setIncomeOpen(false);
      toast.success('Ingreso de la quincena registrado');
      await refreshAfterMutation();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo guardar el ingreso';
      setIncomeError(message);
      throw err;
    }
  };

  return (
    <QuickCaptureContext.Provider value={value}>
      <MonthlyPanelRefreshProvider refresh={refreshPanel}>
        <MonthlyPanelRefreshRegisterProvider register={registerPanelRefresh}>
          {children}
        </MonthlyPanelRefreshRegisterProvider>
      </MonthlyPanelRefreshProvider>
      <QuickCaptureChooser
        open={chooserOpen}
        onOpenChange={setChooserOpen}
        onChooseExpense={openExpense}
        onChooseIncome={openIncome}
      />
      <QuickExpenseSheet
        open={expenseOpen}
        onOpenChange={(next) => {
          setExpenseOpen(next);
          if (!next) setExpenseError(null);
        }}
        onSave={handleSaveExpense}
        error={expenseError}
      />
      <QuickIncomeSheet
        open={incomeOpen}
        onOpenChange={(next) => {
          setIncomeOpen(next);
          if (!next) setIncomeError(null);
        }}
        onSave={handleSaveIncome}
        error={incomeError}
      />
    </QuickCaptureContext.Provider>
  );
}
