'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  AmountRow,
  DateStepper,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_INPUT_CLASS,
} from '@/components/overlay/overlay-form';
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
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={editingItem ? 'Editar cuota futura' : 'Agregar cuota futura'}
      description="Registra un pago programado sin crear compra ni cambiar la deuda de la tarjeta."
      busy={submitting}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
        className="flex flex-col gap-3"
        aria-busy={submitting}
      >
        <div className={OVERLAY_GROUPED_CARD_CLASS}>
          <AmountRow
            id="scheduled-amount"
            value={amount}
            onChange={setAmount}
            ariaLabel="Monto de la cuota futura"
          />

          <GroupedRow label="Fecha">
            <DateStepper value={dueDate} onChange={setDueDate} />
          </GroupedRow>

          <GroupedRow label="Etiqueta">
            <Input
              id="scheduled-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Opcional, ej. MSI Liverpool"
              aria-label="Etiqueta de la cuota futura"
              maxLength={120}
              autoCapitalize="sentences"
              className={OVERLAY_ROW_INPUT_CLASS}
            />
          </GroupedRow>
        </div>

        <Button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className={OVERLAY_PRIMARY_BUTTON_CLASS}
        >
          {submitting ? 'Guardando…' : editingItem ? 'Guardar' : 'Agregar'}
        </Button>
      </form>
    </ResponsiveOverlay>
  );
};
