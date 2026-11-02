'use client';

import { invalidateRecentMovements } from '@/lib/ui/wallet-recent-movements';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import CreditCardPaymentDialog, {
  type CreditCardPaymentSubmitPayload,
} from '@/components/credit-cards/CreditCardPaymentDialog';
import CreditCardQuickPurchaseDialog from '@/components/credit-cards/CreditCardQuickPurchaseDialog';
import AddTransactionDialog from '@/components/transactions/AddTransactionDialog';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  createCreditCardPayment,
  getCreditCardStatement,
} from '@/lib/api/credit-cards';
import { createWalletIncome } from '@/lib/api/incomes';
import { periodObligationPrefillAmount } from '@/lib/finance/card-period-obligation';
import { effectiveCreditLimit } from '@/lib/ui/wallet-cover-flow';
import type {
  AddExpenseFormValues,
  AddIncomeFormValues,
} from '@/schemas/transaction.schema';
import type { PaymentMethodOption, WalletListItem } from '@/types/catalog';
import type { FinanceContextType } from '@/types/finance-context';

type Options = {
  wallets: WalletListItem[];
  context: FinanceContextType;
  /** Reload the wallet list after something changed a balance. */
  reload: () => Promise<void> | void;
};

/**
 * Dialogs behind the Billeteras quick actions: Agregar movimiento (gasto or
 * ingreso) for cash and debit, Agregar compra and Pagar for credit and store
 * cards. The page renders `dialogs` once and calls the openers.
 */
export const useWalletQuickActions = ({ wallets, context, reload: reloadWallets }: Options) => {
  // Any save here can add a movement: drop cached lists before refetching.
  const reload = async () => {
    invalidateRecentMovements();
    await reloadWallets();
  };
  const [movementWallet, setMovementWallet] = useState<WalletListItem | null>(null);
  const [expenseError, setExpenseError] = useState<string | null>(null);
  const [incomeError, setIncomeError] = useState<string | null>(null);
  const [purchaseWallet, setPurchaseWallet] = useState<WalletListItem | null>(null);
  const [payWallet, setPayWallet] = useState<WalletListItem | null>(null);
  const [payPrefill, setPayPrefill] = useState<number | null>(null);
  const [payPendingId, setPayPendingId] = useState<number | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const fundingWalletOptions = useMemo(
    (): PaymentMethodOption[] =>
      wallets
        .filter((w) => w.active && (w.type === 'CASH' || w.type === 'DEBIT_CARD'))
        .map((w) => ({
          id: w.id,
          name: w.name,
          provider_icon_key: w.provider_icon_key,
          type: w.type,
          amount: Number(w.amount) || 0,
        })),
    [wallets],
  );

  const openMovement = useCallback((wallet: WalletListItem) => {
    setExpenseError(null);
    setIncomeError(null);
    setMovementWallet(wallet);
  }, []);

  const openPurchase = useCallback((wallet: WalletListItem) => {
    setPurchaseWallet(wallet);
  }, []);

  // The payment amount comes from the statement, so fetch it before opening.
  const openPay = useCallback(
    async (wallet: WalletListItem) => {
      setPayPendingId(wallet.id);
      setPayError(null);
      let prefill: number | null = null;
      try {
        const statement = await getCreditCardStatement(wallet.id, context);
        prefill = periodObligationPrefillAmount(statement.period_obligation);
      } catch {
        toast.error('No se pudo cargar el monto del pago. Captúralo a mano.');
      } finally {
        setPayPendingId(null);
      }
      setPayPrefill(prefill);
      setPayWallet(wallet);
    },
    [context],
  );

  const handleCreateExpense = async (values: AddExpenseFormValues) => {
    setExpenseError(null);
    try {
      await clientFetchFromApi(
        '/api/expenses',
        { method: 'POST', body: JSON.stringify(values) },
        context,
      );
      toast.success('Gasto registrado');
      setMovementWallet(null);
      await reload();
    } catch (err) {
      setExpenseError(
        err instanceof Error ? err.message : 'No se pudo crear el gasto',
      );
      throw err;
    }
  };

  const handleCreateIncome = async (values: AddIncomeFormValues) => {
    setIncomeError(null);
    try {
      await createWalletIncome(
        values.walletId,
        {
          date: values.date,
          amount: values.amount,
          source: values.name,
          category_id: values.categoryId,
        },
        context,
      );
      toast.success('Ingreso registrado');
      setMovementWallet(null);
      await reload();
    } catch (err) {
      setIncomeError(
        err instanceof Error ? err.message : 'No se pudo registrar el ingreso',
      );
      throw err;
    }
  };

  const handlePay = async (data: CreditCardPaymentSubmitPayload) => {
    if (!payWallet) return;
    try {
      setPaySubmitting(true);
      setPayError(null);
      await createCreditCardPayment(
        payWallet.id,
        { mode: 'wallet', ...data, create_fortnight_expense: true },
        context,
      );
      toast.success('Pago registrado');
      setPayWallet(null);
      await reload();
    } catch (err) {
      setPayError(
        err instanceof Error ? err.message : 'Error al registrar el pago',
      );
    } finally {
      setPaySubmitting(false);
    }
  };

  const purchaseLimit = purchaseWallet ? effectiveCreditLimit(purchaseWallet) : null;

  const dialogs: ReactNode = (
    <>
      {movementWallet ? (
        <AddTransactionDialog
          open
          onOpenChange={(open) => {
            if (!open) setMovementWallet(null);
          }}
          defaultTab="expense"
          expenseDefaults={{ paymentMethodId: movementWallet.id, isPaid: true }}
          incomeDefaults={{ walletId: movementWallet.id }}
          onSaveExpense={handleCreateExpense}
          onSaveIncome={handleCreateIncome}
          expenseError={expenseError}
          incomeError={incomeError}
        />
      ) : null}

      {purchaseWallet ? (
        <CreditCardQuickPurchaseDialog
          open
          onOpenChange={(open) => {
            if (!open) setPurchaseWallet(null);
          }}
          creditCardId={purchaseWallet.id}
          context={context}
          onSuccess={reload}
          creditLimit={purchaseLimit}
          availableCredit={
            purchaseLimit != null
              ? purchaseLimit - (Number(purchaseWallet.amount) || 0)
              : null
          }
        />
      ) : null}

      {payWallet ? (
        <CreditCardPaymentDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setPayWallet(null);
              setPayError(null);
            }
          }}
          fundingWalletOptions={fundingWalletOptions}
          prefillAmount={payPrefill}
          submitting={paySubmitting}
          error={payError}
          onConfirm={handlePay}
        />
      ) : null}
    </>
  );

  return { openMovement, openPurchase, openPay, payPendingId, dialogs };
};
