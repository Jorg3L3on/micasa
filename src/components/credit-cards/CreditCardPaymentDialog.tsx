'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import type { PaymentMethodOption } from '@/types/catalog';

const getTodayDateString = () => new Date().toISOString().split('T')[0];

export type CreditCardPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fundingWalletOptions: PaymentMethodOption[];
  nextDuePayment: number;
  outstandingBalance: number;
  submitting: boolean;
  error: string | null;
  onSubmit: (data: {
    source_wallet_id: number;
    amount: number;
    paid_at: string;
    note: string | null;
  }) => Promise<void>;
};

const CreditCardPaymentDialog = ({
  open,
  onOpenChange,
  fundingWalletOptions,
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

  useEffect(() => {
    if (open) {
      setSourceWalletId('');
      setAmount('');
      setPaidAt(getTodayDateString());
      setNote('');
    }
  }, [open]);

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
    await onSubmit({
      source_wallet_id: Number(sourceWalletId),
      amount: Number(amount),
      paid_at: `${paidAt}T12:00:00.000Z`,
      note: note.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            Transfiere saldo desde una billetera de efectivo o débito hacia esta
            tarjeta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePayMinimum}
              disabled={nextDuePayment <= 0}
              aria-label={`Pagar mínimo ${formatCurrency(nextDuePayment)}`}
            >
              Pagar mínimo ({formatCurrency(nextDuePayment)})
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
                    {`${wallet.name} · ${formatCurrency(wallet.amount ?? 0)}`}
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
            <Button type="submit" disabled={submitting || !sourceWalletId}>
              {submitting ? 'Guardando...' : 'Registrar pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreditCardPaymentDialog;
