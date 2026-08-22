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
import { todayCalendarDate } from '@/lib/calendar-dates';
import { formatCurrency } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/currency-input';

export type CreditCardExternalPaymentSubmitPayload = {
  mode: 'external';
  amount: number;
  paid_at: string;
  note: string | null;
  adjusts_debt: boolean;
};

export type CreditCardExternalPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextDuePayment: number;
  outstandingBalance: number;
  submitting: boolean;
  error: string | null;
  onConfirm: (data: CreditCardExternalPaymentSubmitPayload) => Promise<void>;
};

export const CreditCardExternalPaymentDialog = ({
  open,
  onOpenChange,
  nextDuePayment,
  outstandingBalance,
  submitting,
  error,
  onConfirm,
}: CreditCardExternalPaymentDialogProps) => {
  const [amount, setAmount] = useState(0);
  const [paidAt, setPaidAt] = useState(todayCalendarDate());
  const [note, setNote] = useState('');
  const [adjustsDebt, setAdjustsDebt] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const suggested =
      nextDuePayment > 0
        ? nextDuePayment
        : outstandingBalance > 0
          ? outstandingBalance
          : 0;
    setAmount(suggested);
    setPaidAt(todayCalendarDate());
    setNote('');
    setAdjustsDebt(true);
    setLocalError(null);
  }, [open, nextDuePayment, outstandingBalance]);

  const handleSubmit = async () => {
    if (submitting) return;
    setLocalError(null);

    if (!Number.isFinite(amount) || amount <= 0) {
      setLocalError('Ingresa un monto válido.');
      return;
    }

    await onConfirm({
      mode: 'external',
      amount: Number(amount),
      paid_at: paidAt,
      note: note.trim() || null,
      adjusts_debt: adjustsDebt,
    });
  };

  const displayError = localError ?? error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="external-payment-desc">
        <DialogHeader>
          <DialogTitle>Registrar pago histórico</DialogTitle>
          <DialogDescription id="external-payment-desc">
            Marca el pago como realizado sin descontar una billetera de
            efectivo o débito.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
          className="space-y-4"
          aria-busy={submitting}
        >
          {displayError ? (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {displayError}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => nextDuePayment > 0 && setAmount(nextDuePayment)}
              disabled={nextDuePayment <= 0}
            >
              Pago próximo ({formatCurrency(nextDuePayment)})
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="external-amount">
                Monto
              </label>
              <CurrencyInput
                id="external-amount"
                value={amount}
                onChange={setAmount}
                aria-label="Monto del pago histórico"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="external-date">
                Fecha de pago
              </label>
              <Input
                id="external-date"
                type="date"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
                aria-label="Fecha del pago histórico"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border/60 px-3 py-2.5">
            <Checkbox
              id="adjusts-debt"
              checked={!adjustsDebt}
              onCheckedChange={(value) => setAdjustsDebt(value !== true)}
              aria-describedby="adjusts-debt-desc"
            />
            <div className="grid gap-1.5 leading-none">
              <Label htmlFor="adjusts-debt" className="cursor-pointer text-sm font-medium">
                La deuda ya está ajustada al corte
              </Label>
              <p
                id="adjusts-debt-desc"
                className="text-xs leading-snug text-muted-foreground"
              >
                Solo bitácora: registra el movimiento sin volver a bajar la
                deuda de la tarjeta.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="external-note">
              Nota
            </label>
            <Input
              id="external-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Opcional"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? 'Guardando…' : 'Ya pagado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
