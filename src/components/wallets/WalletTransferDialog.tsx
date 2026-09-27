'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleField } from '@/components/ui/toggle';
import { createWalletTransfer } from '@/lib/api/wallets';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { isGoalWalletType, isTransferableWalletType } from '@/domain/payment-method';
import { cn, formatCurrency } from '@/lib/utils';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  AmountRow,
  DateStepper,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_INPUT_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
  OverlayErrorBanner,
  OverlayHint,
  OverlaySectionLabel,
} from '@/components/overlay/overlay-form';
import type { FinanceContextType } from '@/types/finance-context';

export type WalletTransferOption = {
  id: number;
  name: string;
  type: string;
  amount: number;
  active: boolean;
};

export type WalletTransferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: WalletTransferOption[];
  /** Pre-select source wallet when opened from a card/detail. */
  defaultFromWalletId?: number | null;
  context: FinanceContextType;
  onSuccess: () => Promise<void> | void;
};

const DIALOG_DESCRIPTION =
  'Mueve saldo entre efectivo y débito del mismo contexto. No crea ingresos ni gastos en el panel.';

const WalletTransferDialog = ({
  open,
  onOpenChange,
  wallets,
  defaultFromWalletId = null,
  context,
  onSuccess,
}: WalletTransferDialogProps) => {
  const fundingWallets = useMemo(
    () =>
      wallets.filter((w) => w.active && isTransferableWalletType(w.type)),
    [wallets],
  );

  const [amount, setAmount] = useState('');
  const [fromWalletId, setFromWalletId] = useState<string>('');
  const [toWalletId, setToWalletId] = useState<string>('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayCalendarDate());
  const [addFee, setAddFee] = useState(false);
  const [feeAmount, setFeeAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmNegativeOpen, setConfirmNegativeOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setNote('');
    setDate(todayCalendarDate());
    setAddFee(false);
    setFeeAmount('');
    setConfirmNegativeOpen(false);

    const preferredFrom =
      defaultFromWalletId != null &&
      fundingWallets.some((w) => w.id === defaultFromWalletId)
        ? defaultFromWalletId
        : fundingWallets[0]?.id;
    setFromWalletId(preferredFrom != null ? String(preferredFrom) : '');

    const toCandidate = fundingWallets.find((w) => w.id !== preferredFrom);
    setToWalletId(toCandidate != null ? String(toCandidate.id) : '');
  }, [open, defaultFromWalletId, fundingWallets]);

  const fromWallet = fundingWallets.find((w) => String(w.id) === fromWalletId);
  const toOptions = fundingWallets.filter((w) => String(w.id) !== fromWalletId);
  const fromLocked = defaultFromWalletId != null;

  const parsedAmount = Number(amount.replace(/[,\s]/g, '')) || 0;
  const parsedFee =
    addFee ? Number(feeAmount.replace(/[,\s]/g, '')) || 0 : 0;
  const sourceDebit = parsedAmount + parsedFee;
  const wouldGoNegative =
    fromWallet != null && fromWallet.amount < sourceDebit && sourceDebit > 0;
  const fromIsGoal = fromWallet != null && isGoalWalletType(fromWallet.type);
  const goalExceedsSaved = fromIsGoal && wouldGoNegative;

  const submitTransfer = async () => {
    if (!fromWalletId || !toWalletId) {
      toast.error('Selecciona billetera origen y destino');
      return;
    }
    if (fromWalletId === toWalletId) {
      toast.error('Origen y destino deben ser distintas');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    if (addFee && (!Number.isFinite(parsedFee) || parsedFee < 0)) {
      toast.error('Ingresa una comisión válida');
      return;
    }
    if (goalExceedsSaved && fromWallet) {
      toast.error(
        `En una meta no puedes transferir más de lo ahorrado (${formatCurrency(fromWallet.amount)})`,
      );
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error('Fecha inválida');
      return;
    }

    try {
      setSubmitting(true);
      await createWalletTransfer(
        {
          from_wallet_id: Number(fromWalletId),
          to_wallet_id: Number(toWalletId),
          amount: parsedAmount,
          fee_amount: parsedFee,
          note: note.trim() || null,
          transferred_at: date,
          exclude_from_report: true,
        },
        context,
      );
      toast.success('Transferencia registrada');
      onOpenChange(false);
      await onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo transferir',
      );
    } finally {
      setSubmitting(false);
      setConfirmNegativeOpen(false);
    }
  };

  const handleSubmitClick = () => {
    if (goalExceedsSaved && fromWallet) {
      toast.error(
        `En una meta no puedes transferir más de lo ahorrado (${formatCurrency(fromWallet.amount)})`,
      );
      return;
    }
    if (wouldGoNegative) {
      setConfirmNegativeOpen(true);
      return;
    }
    void submitTransfer();
  };

  const canTransfer = fundingWallets.length >= 2;

  const renderFormBody = (
    handleSelectOpenChange: (nextOpen: boolean) => void,
  ) => (
    <div className="flex flex-col gap-3">
      {!canTransfer ? (
        <OverlayHint>
          Necesitas al menos dos billeteras de efectivo o débito activas para
          transferir.
        </OverlayHint>
      ) : (
        <>
          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <AmountRow
              id="wallet-transfer-amount"
              value={parsedAmount}
              onChange={(val) => setAmount(val === 0 ? '' : String(val))}
              disabled={submitting}
              ariaLabel="Monto a transferir"
            />

            <GroupedRow label="Desde">
              {fromLocked && fromWallet ? (
                <Input
                  value={`${fromWallet.name} · ${formatCurrency(fromWallet.amount)}`}
                  disabled
                  readOnly
                  aria-label="Billetera origen"
                  className={cn(
                    OVERLAY_ROW_INPUT_CLASS,
                    'disabled:cursor-default disabled:opacity-100',
                  )}
                />
              ) : (
                <Select
                  value={fromWalletId}
                  onOpenChange={handleSelectOpenChange}
                  onValueChange={(value) => {
                    setFromWalletId(value);
                    if (toWalletId === value) {
                      const next = fundingWallets.find(
                        (w) => String(w.id) !== value,
                      );
                      setToWalletId(next != null ? String(next.id) : '');
                    }
                  }}
                  disabled={submitting}
                >
                  <SelectTrigger
                    aria-label="Billetera origen"
                    className={OVERLAY_ROW_TRIGGER_CLASS}
                  >
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {fundingWallets.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name} · {formatCurrency(w.amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </GroupedRow>

            <GroupedRow label="Hacia">
              <Select
                value={toWalletId}
                onOpenChange={handleSelectOpenChange}
                onValueChange={setToWalletId}
                disabled={submitting}
              >
                <SelectTrigger
                  aria-label="Billetera destino"
                  className={OVERLAY_ROW_TRIGGER_CLASS}
                >
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {toOptions.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name} · {formatCurrency(w.amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GroupedRow>

            <GroupedRow label="Nota">
              <Input
                id="wallet-transfer-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opcional"
                disabled={submitting}
                className={OVERLAY_ROW_INPUT_CLASS}
                autoCapitalize="sentences"
                enterKeyHint="next"
              />
            </GroupedRow>

            <GroupedRow label="Fecha">
              <DateStepper value={date} onChange={setDate} disabled={submitting} />
            </GroupedRow>
          </div>

          {goalExceedsSaved ? (
            <OverlayErrorBanner>
              El monto no puede ser mayor al ahorro de la meta.
            </OverlayErrorBanner>
          ) : null}
          {fromIsGoal && fromWallet ? (
            <OverlayHint>
              Máximo ahorrado:{' '}
              <span className="font-mono tabular-nums text-foreground">
                {formatCurrency(fromWallet.amount)}
              </span>
            </OverlayHint>
          ) : null}

          <ToggleField
            label="Agregar comisión"
            checked={addFee}
            onCheckedChange={(checked) => {
              setAddFee(checked);
              if (!checked) setFeeAmount('');
            }}
            disabled={submitting}
            layout="row"
            className="px-3"
          />

          {addFee ? (
            <>
              <OverlaySectionLabel>Comisión</OverlaySectionLabel>
              <div className={OVERLAY_GROUPED_CARD_CLASS}>
                <AmountRow
                  id="wallet-transfer-fee"
                  value={parsedFee}
                  onChange={(val) => setFeeAmount(val === 0 ? '' : String(val))}
                  disabled={submitting}
                  enterKeyHint="done"
                  ariaLabel="Comisión de transferencia"
                />
              </div>
              {parsedAmount > 0 ? (
                <OverlayHint>
                  Origen descuenta{' '}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrency(sourceDebit)}
                  </span>
                  ; destino recibe{' '}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrency(parsedAmount)}
                  </span>
                  .
                </OverlayHint>
              ) : null}
            </>
          ) : null}
        </>
      )}

      <Button
        type="button"
        onClick={handleSubmitClick}
        disabled={submitting || !canTransfer}
        className={OVERLAY_PRIMARY_BUTTON_CLASS}
      >
        {submitting ? 'Transferiendo…' : 'Transferir'}
      </Button>
    </div>
  );

  return (
    <>
      <ResponsiveOverlay
        open={open}
        onOpenChange={onOpenChange}
        title="Transferir saldo"
        description={DIALOG_DESCRIPTION}
        busy={submitting}
      >
        {({ handleSelectOpenChange }) =>
          open ? renderFormBody(handleSelectOpenChange) : null
        }
      </ResponsiveOverlay>

      <ConfirmDeleteDialog
        open={confirmNegativeOpen}
        onOpenChange={setConfirmNegativeOpen}
        onConfirm={submitTransfer}
        title="Saldo insuficiente"
        description={
          fromWallet
            ? `${fromWallet.name} tiene ${formatCurrency(fromWallet.amount)} y se descontarán ${formatCurrency(sourceDebit)}. El saldo quedará negativo. ¿Continuar?`
            : 'El saldo de origen quedará negativo. ¿Continuar?'
        }
        confirmLabel="Transferir de todos modos"
        loadingLabel="Transfiriendo…"
        tone="default"
        busy={submitting}
      />
    </>
  );
};

export default WalletTransferDialog;
