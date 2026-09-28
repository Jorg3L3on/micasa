'use client';

import { ErrorBanner } from '@/components/error-banner';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleField } from '@/components/ui/toggle';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { formatCurrency } from '@/lib/utils';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  AmountRow,
  DateStepper,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_INPUT_CLASS,
} from '@/components/overlay/overlay-form';

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
  /** Period obligation amount. Null leaves the field empty (missing corte). */
  prefillAmount: number | null;
  submitting: boolean;
  error: string | null;
  onConfirm: (data: CreditCardExternalPaymentSubmitPayload) => Promise<void>;
};

export const CreditCardExternalPaymentDialog = ({
  open,
  onOpenChange,
  prefillAmount,
  submitting,
  error,
  onConfirm,
}: CreditCardExternalPaymentDialogProps) => {
  const [amount, setAmount] = useState<number | null>(null);
  const [paidAt, setPaidAt] = useState(todayCalendarDate());
  const [note, setNote] = useState('');
  const [adjustsDebt, setAdjustsDebt] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset form state each time the dialog opens.
    setAmount(prefillAmount);
    setPaidAt(todayCalendarDate());
    setNote('');
    setAdjustsDebt(true);
    setLocalError(null);
  }, [open, prefillAmount]);

  const handleSubmit = async () => {
    if (submitting) return;
    setLocalError(null);

    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      setLocalError('Ingresa un monto válido.');
      return;
    }

    await onConfirm({
      mode: 'external',
      amount,
      paid_at: paidAt,
      note: note.trim() || null,
      adjusts_debt: adjustsDebt,
    });
  };

  const displayError = localError ?? error;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar pago histórico"
      description="Marca el pago como realizado sin descontar una billetera de efectivo o débito."
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
        {displayError ? (
          <ErrorBanner>{displayError}</ErrorBanner>
        ) : null}

        {prefillAmount != null && prefillAmount > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setAmount(prefillAmount)}
          >
            Toca pagar este corte ({formatCurrency(prefillAmount)})
          </Button>
        ) : null}

        <div className={OVERLAY_GROUPED_CARD_CLASS}>
          <AmountRow
            id="external-amount"
            value={amount}
            onChange={setAmount}
            ariaLabel="Monto del pago histórico"
          />

          <GroupedRow label="Fecha">
            <DateStepper value={paidAt} onChange={setPaidAt} />
          </GroupedRow>

          <GroupedRow label="Nota">
            <Input
              id="external-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Opcional"
              aria-label="Nota del pago histórico"
              autoCapitalize="sentences"
              className={OVERLAY_ROW_INPUT_CLASS}
            />
          </GroupedRow>
        </div>

        <ToggleField
          layout="row"
          className="px-3"
          label="La deuda ya está ajustada al corte"
          helper="Solo bitácora: registra el movimiento sin volver a bajar la deuda de la tarjeta."
          checked={!adjustsDebt}
          onCheckedChange={(checked) => setAdjustsDebt(!checked)}
          aria-label="La deuda ya está ajustada al corte"
        />

        <Button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className={OVERLAY_PRIMARY_BUTTON_CLASS}
        >
          {submitting ? 'Guardando…' : 'Ya pagado'}
        </Button>
      </form>
    </ResponsiveOverlay>
  );
};
