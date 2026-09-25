'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleField } from '@/components/ui/toggle';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { formatCurrency } from '@/lib/utils';
import type { PaymentMethodOption } from '@/types/catalog';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  AmountRow,
  DateStepper,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
} from '@/components/overlay/overlay-form';

export type CreditCardPaymentSubmitPayload = {
  source_wallet_id: number;
  amount: number;
  paid_at: string;
  note: string | null;
  create_fortnight_expense: boolean;
  fortnight_id?: number;
};

export type CreditCardPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fundingWalletOptions: PaymentMethodOption[];
  /** Period obligation amount. Null leaves the field empty (missing corte). */
  prefillAmount: number | null;
  submitting: boolean;
  error: string | null;
  /** When paying from planner / Compromisos, pin expense to this fortnight. */
  fortnightId?: number;
  onConfirm: (data: CreditCardPaymentSubmitPayload) => Promise<void>;
};

const CreditCardPaymentDialog = ({
  open,
  onOpenChange,
  fundingWalletOptions,
  prefillAmount,
  submitting,
  error,
  fortnightId,
  onConfirm,
}: CreditCardPaymentDialogProps) => {
  const [sourceWalletId, setSourceWalletId] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [paidAt, setPaidAt] = useState(todayCalendarDate());
  const [createFortnightExpense, setCreateFortnightExpense] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset form state each time the payment dialog opens.
    setSourceWalletId('');
    setAmount(prefillAmount);
    setPaidAt(todayCalendarDate());
    setCreateFortnightExpense(true);
    setLocalError(null);
  }, [open, prefillAmount]);

  const selectedSource = fundingWalletOptions.find(
    (w) => String(w.id) === sourceWalletId,
  );

  const submitPayment = async () => {
    if (submitting) return;
    setLocalError(null);

    if (amount == null || !Number.isFinite(amount) || amount <= 0) {
      setLocalError('Ingresa un monto válido.');
      return;
    }

    const payload: CreditCardPaymentSubmitPayload = {
      source_wallet_id: Number(sourceWalletId),
      amount,
      paid_at: paidAt,
      note: null,
      create_fortnight_expense: createFortnightExpense,
      ...(fortnightId != null ? { fortnight_id: fortnightId } : {}),
    };

    await onConfirm(payload);
  };

  const displayError = localError ?? error;

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar pago"
      description="Registra un pago de tarjeta desde una billetera de fondeo."
      busy={submitting}
    >
      {({ handleSelectOpenChange }) => (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitPayment();
          }}
          className="flex flex-col gap-3"
          aria-busy={submitting}
        >
          {displayError ? (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {displayError}
            </div>
          ) : null}

          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <GroupedRow label="Billetera">
              <Select
                value={sourceWalletId || undefined}
                onOpenChange={handleSelectOpenChange}
                onValueChange={setSourceWalletId}
              >
                <SelectTrigger
                  className={OVERLAY_ROW_TRIGGER_CLASS}
                  aria-label="Selecciona la billetera origen"
                >
                  <SelectValue placeholder="Selecciona">
                    {selectedSource ? (
                      <WalletIdentity
                        name={selectedSource.name}
                        providerIconKey={selectedSource.provider_icon_key}
                        iconClassName="h-8 w-8 rounded-lg"
                      />
                    ) : null}
                  </SelectValue>
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
            </GroupedRow>

            <AmountRow
              value={amount}
              onChange={setAmount}
              ariaLabel="Monto del pago"
            />

            <GroupedRow label="Fecha">
              <DateStepper value={paidAt} onChange={setPaidAt} />
            </GroupedRow>
          </div>

          <ToggleField
            layout="row"
            className="px-3"
            label="Registrar en la quincena"
            checked={createFortnightExpense}
            onCheckedChange={setCreateFortnightExpense}
            aria-label="Registrar en la quincena"
          />

          <Button
            type="submit"
            disabled={submitting || !sourceWalletId}
            aria-busy={submitting}
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
          >
            {submitting ? 'Guardando…' : 'Registrar pago'}
          </Button>
        </form>
      )}
    </ResponsiveOverlay>
  );
};

export default CreditCardPaymentDialog;
