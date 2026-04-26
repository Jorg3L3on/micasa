'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import type { CategoryOption, PaymentMethodOption } from '@/types/catalog';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

/** Persist last category used for “registrar en quincena” (see ui-consistency / micasa.* keys). */
const LAST_CATEGORY_STORAGE_KEY = 'micasa.creditCardPayment.lastCategoryId';

export type CreditCardPaymentSubmitPayload = {
  source_wallet_id: number;
  amount: number;
  paid_at: string;
  note: string | null;
  create_fortnight_expense: boolean;
  category_id?: number;
};

export type CreditCardPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fundingWalletOptions: PaymentMethodOption[];
  categoryOptions: CategoryOption[];
  nextDuePayment: number;
  outstandingBalance: number;
  submitting: boolean;
  error: string | null;
  onSubmit: (data: CreditCardPaymentSubmitPayload) => Promise<void>;
};

const CreditCardPaymentDialog = ({
  open,
  onOpenChange,
  fundingWalletOptions,
  categoryOptions,
  nextDuePayment,
  outstandingBalance,
  submitting,
  error,
  onSubmit,
}: CreditCardPaymentDialogProps) => {
  const [sourceWalletId, setSourceWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(getTodayDateString());
  const [note, setNote] = useState('');
  const [createFortnightExpense, setCreateFortnightExpense] = useState(true);
  const [categoryId, setCategoryId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSourceWalletId('');
    setAmount('');
    setPaidAt(getTodayDateString());
    setNote('');
    setCreateFortnightExpense(true);
    setLocalError(null);

    let initialCategory = '';
    try {
      const raw = localStorage.getItem(LAST_CATEGORY_STORAGE_KEY);
      if (raw && categoryOptions.some((c) => String(c.id) === raw)) {
        initialCategory = raw;
      }
    } catch {
      /* ignore */
    }
    setCategoryId(initialCategory);
  }, [open, categoryOptions]);

  const selectedSource = fundingWalletOptions.find(
    (w) => String(w.id) === sourceWalletId,
  );
  const sourceBalance = selectedSource?.amount ?? 0;

  const handlePayMinimum = () => {
    if (nextDuePayment <= 0) return;
    const capped = selectedSource
      ? Math.min(nextDuePayment, sourceBalance)
      : nextDuePayment;
    setAmount(String(capped));
  };

  const handlePayFull = () => {
    if (outstandingBalance <= 0) return;
    const capped = selectedSource
      ? Math.min(outstandingBalance, sourceBalance)
      : outstandingBalance;
    setAmount(String(capped));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    if (createFortnightExpense && !categoryId) {
      setLocalError('Elige una categoría para el gasto en la quincena.');
      return;
    }

    const payload: CreditCardPaymentSubmitPayload = {
      source_wallet_id: Number(sourceWalletId),
      amount: Number(amount),
      paid_at: `${paidAt}T12:00:00.000Z`,
      note: note.trim() || null,
      create_fortnight_expense: createFortnightExpense,
      ...(createFortnightExpense && categoryId
        ? { category_id: Number(categoryId) }
        : {}),
    };

    if (createFortnightExpense && categoryId) {
      try {
        localStorage.setItem(LAST_CATEGORY_STORAGE_KEY, categoryId);
      } catch {
        /* ignore */
      }
    }

    await onSubmit(payload);
  };

  const displayError = localError ?? error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Transfiere saldo desde efectivo o débito hacia esta tarjeta. El
            mínimo sugerido sale de los movimientos registrados en MiCasa; tu
            banco puede indicar otro importe. El pago no puede superar la deuda
            que ves en la tarjeta aquí.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {displayError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {displayError}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePayMinimum}
              disabled={nextDuePayment <= 0}
              aria-label={`Pagar mínimo sugerido ${formatCurrency(nextDuePayment)}`}
            >
              Mínimo sugerido ({formatCurrency(nextDuePayment)})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePayFull}
              disabled={outstandingBalance <= 0}
              aria-label={`Pagar saldo total ${formatCurrency(outstandingBalance)}`}
            >
              Saldo total ({formatCurrency(outstandingBalance)})
            </Button>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">Billetera origen</span>
            <Select
              value={sourceWalletId || undefined}
              onValueChange={setSourceWalletId}
            >
              <SelectTrigger
                className="w-full max-w-none"
                aria-label="Selecciona la billetera origen"
              >
                <SelectValue placeholder="Selecciona una billetera" />
              </SelectTrigger>
              <SelectContent>
                {fundingWalletOptions.map((wallet) => (
                  <SelectItem key={wallet.id} value={String(wallet.id)}>
                    <span className="flex items-center justify-between gap-3">
                      <WalletIdentity
                        name={wallet.name}
                        providerIconKey={wallet.provider_icon_key}
                        iconClassName="h-5 w-5 rounded-md"
                      />
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(wallet.amount ?? 0)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="payment-amount">
                Monto
              </label>
              <Input
                id="payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-label="Monto del pago"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="payment-date">
                Fecha de pago
              </label>
              <Input
                id="payment-date"
                type="date"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
                aria-label="Fecha del pago"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border/60 px-3 py-2.5">
            <Checkbox
              id="create-fortnight-expense"
              checked={createFortnightExpense}
              onCheckedChange={(v) =>
                setCreateFortnightExpense(v === true)
              }
              aria-describedby="create-fortnight-expense-desc"
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="create-fortnight-expense"
                className="text-sm font-medium cursor-pointer"
              >
                Registrar en la quincena
              </Label>
              <p
                id="create-fortnight-expense-desc"
                className="text-[11px] text-muted-foreground leading-snug"
              >
                Crea un gasto pagado desde la billetera origen en la quincena de
                la fecha de pago (para tu planificación mensual).
              </p>
            </div>
          </div>

          {createFortnightExpense ? (
            <div className="space-y-2">
              <span className="text-sm font-medium">Categoría del gasto</span>
              <Select
                value={categoryId || undefined}
                onValueChange={setCategoryId}
              >
                <SelectTrigger
                  className="w-full max-w-none"
                  aria-label="Categoría para el gasto en la quincena"
                >
                  <SelectValue placeholder="Selecciona categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="payment-note">
              Nota
            </label>
            <Input
              id="payment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-label="Nota del pago"
              placeholder="Opcional"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                submitting ||
                !sourceWalletId ||
                (createFortnightExpense && !categoryId)
              }
            >
              {submitting ? 'Guardando...' : 'Registrar pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreditCardPaymentDialog;
