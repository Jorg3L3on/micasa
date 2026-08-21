'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuickExpenseSheet } from '@/components/quick-capture/QuickExpenseSheet';
import type { QuickExpenseFormValues } from '@/schemas/transaction.schema';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';

type QuickCaptureContextValue = {
  openExpense: () => void;
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

const needsRaisedFab = (pathname: string): boolean => {
  if (pathname === '/wallets' || pathname.startsWith('/wallets/')) return true;
  if (pathname === '/metas' || pathname.startsWith('/metas/')) return true;
  if (/^\/credit-cards\/[^/]+/.test(pathname)) return true;
  return false;
};

type QuickCaptureHostProps = {
  children?: ReactNode;
};

/**
 * Provides quick-expense open API, mobile FAB (path-aware offset), and sheet.
 * Mount once under the authenticated app shell.
 */
export function QuickCaptureHost({ children }: QuickCaptureHostProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { context } = useFinanceContext();

  const openExpense = useCallback(() => {
    setError(null);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openExpense }), [openExpense]);

  const handleSave = async (values: QuickExpenseFormValues) => {
    setError(null);
    try {
      await clientFetchFromApi(
        '/api/expenses',
        {
          method: 'POST',
          body: JSON.stringify({
            name: values.name,
            categoryId: values.categoryId,
            amount: values.amount,
            paymentMethodId: values.isPaid ? values.paymentMethodId : null,
            date: values.date,
            isPaid: values.isPaid,
            isRecurring: false,
            applyToBothFortnights: false,
            applyWalletDelta: values.isPaid ? values.applyWalletDelta : undefined,
          }),
        },
        context,
      );
      setOpen(false);
      toast.success(
        values.isPaid ? 'Gasto registrado' : 'Gasto planificado',
      );
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo guardar el gasto';
      setError(message);
      throw err;
    }
  };

  const fabBottom = needsRaisedFab(pathname) ? 'bottom-24' : 'bottom-6';

  return (
    <QuickCaptureContext.Provider value={value}>
      {children}
      <Button
        type="button"
        size="icon"
        aria-label="Agregar gasto"
        className={cn(
          'fixed right-6 z-50 h-14 w-14 rounded-full shadow-lg sm:hidden',
          fabBottom,
        )}
        onClick={openExpense}
      >
        <Plus className="h-6 w-6" data-icon="inline-start" />
      </Button>
      <QuickExpenseSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        onSave={handleSave}
        error={error}
      />
    </QuickCaptureContext.Provider>
  );
}
