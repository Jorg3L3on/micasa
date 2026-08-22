'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
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
import { CurrencyInput } from '@/components/ui/currency-input';
import type { FinanceContextType } from '@/types/finance-context';
import type { CreditCardScheduledPaymentItem } from '@/types/catalog';
import {
  createCreditCardScheduledPayment,
  updateCreditCardScheduledPayment,
} from '@/lib/api/credit-cards';
import { todayCalendarDate } from '@/lib/calendar-dates';

type CreditCardScheduledPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditCardId: number;
  context: FinanceContextType;
  editingItem: CreditCardScheduledPaymentItem | null;
  onSuccess: () => void | Promise<void>;
};

export const CreditCardScheduledPaymentDialog = ({
  open,
  onOpenChange,
  creditCardId,
  context,
  editingItem,
  onSuccess,
}: CreditCardScheduledPaymentDialogProps) => {
  const [dueDate, setDueDate] = useState(todayCalendarDate());
  const [amount, setAmount] = useState(0);
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingItem) {
      setDueDate(editingItem.dueDate);
      setAmount(editingItem.amount);
      setLabel(editingItem.label ?? '');
    } else {
      setDueDate(todayCalendarDate());
      setAmount(0);
      setLabel('');
    }
  }, [open, editingItem]);

  const handleSubmit = useCallback(async () => {
    if (!dueDate || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Completa fecha y monto válidos');
      return;
    }

    try {
      setSubmitting(true);
      if (editingItem) {
        await updateCreditCardScheduledPayment(
          creditCardId,
          editingItem.id,
          {
            due_date: dueDate,
            amount,
            label: label.trim() || null,
          },
          context,
        );
        toast.success('Cuota futura actualizada');
      } else {
        await createCreditCardScheduledPayment(
          creditCardId,
          {
            due_date: dueDate,
            amount,
            label: label.trim() || null,
          },
          context,
        );
        toast.success('Cuota futura agregada');
      }
      onOpenChange(false);
      await onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo guardar la cuota',
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    amount,
    context,
    creditCardId,
    dueDate,
    editingItem,
    label,
    onOpenChange,
    onSuccess,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? 'Editar cuota futura' : 'Agregar cuota futura'}
          </DialogTitle>
          <DialogDescription>
            Registra un pago programado sin crear compra ni cambiar la deuda de
            la tarjeta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label htmlFor="scheduled-due-date" className="text-sm font-medium">
              Fecha de pago
            </label>
            <Input
              id="scheduled-due-date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="scheduled-amount" className="text-sm font-medium">
              Monto
            </label>
            <CurrencyInput
              id="scheduled-amount"
              value={amount}
              onChange={setAmount}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="scheduled-label" className="text-sm font-medium">
              Etiqueta (opcional)
            </label>
            <Input
              id="scheduled-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Ej. MSI Liverpool"
              maxLength={120}
            />
          </div>
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
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Guardando…' : editingItem ? 'Guardar' : 'Agregar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
