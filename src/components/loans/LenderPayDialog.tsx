'use client';

import { useEffect, useState } from 'react';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  DateStepper,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
} from '@/components/overlay/overlay-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ToggleField } from '@/components/ui/toggle';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { PaymentMethodOption } from '@/types/catalog';
import type { LenderListItem } from '@/types/lenders';
import type { PayLenderInput } from '@/schemas/lender.schema';

type LenderPayDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lender: LenderListItem | null;
  fundingWalletOptions: PaymentMethodOption[];
  submitting: boolean;
  error: string | null;
  onConfirm: (data: PayLenderInput) => Promise<void>;
};

export default function LenderPayDialog({
  open,
  onOpenChange,
  lender,
  fundingWalletOptions,
  submitting,
  error,
  onConfirm,
}: LenderPayDialogProps) {
  const [sourceWalletId, setSourceWalletId] = useState('');
  const [paidAt, setPaidAt] = useState(todayCalendarDate());
  const [external, setExternal] = useState(false);
  const [note, setNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const includedLoanIds = new Set(
      (lender?.payWindow.included ?? []).map((item) => item.loanId),
    );
    const defaultWalletIds = [...new Set(
      (lender?.loans ?? [])
        .filter((loan) => includedLoanIds.has(loan.id))
        .map((loan) => loan.sourceWalletId ?? loan.linkedWalletId)
        .filter((id): id is number => id != null),
    )];
    setSourceWalletId(
      defaultWalletIds.length === 1 ? String(defaultWalletIds[0]) : '',
    );
    setPaidAt(todayCalendarDate());
    setExternal(false);
    setNote('');
    setLocalError(null);
  }, [open, lender]);

  const window = lender?.payWindow;
  const selectedSource = fundingWalletOptions.find(
    (wallet) => String(wallet.id) === sourceWalletId,
  );
  const displayError = localError ?? error;

  const handleSubmit = async () => {
    if (!lender || !window?.canPay) return;
    if (!external && !sourceWalletId) {
      setLocalError('Selecciona la billetera que paga al prestamista');
      return;
    }
    setLocalError(null);
    await onConfirm({
      mode: external ? 'EXTERNAL' : 'WALLET',
      paidAt,
      sourceWalletId: external ? null : Number(sourceWalletId),
      note: note.trim() || null,
    });
  };

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={lender ? `Pagar a ${lender.name}` : 'Pagar prestamista'}
      description="Registra un solo pago y actualiza los calendarios de los contratos de este periodo."
      busy={submitting}
    >
      {({ handleSelectOpenChange }) => (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
          className="flex flex-col gap-3"
          aria-busy={submitting}
        >
          {displayError ? (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {displayError}
            </div>
          ) : null}

          <div className="rounded-xl border border-border/60 bg-card px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Compromiso del periodo
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
              {formatCurrency(window?.amount ?? 0)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {window?.isRange
                ? `${formatDate(window.commitmentDate ?? '')} – ${formatDate(window.commitmentDateEnd ?? '')} · varios vencimientos`
                : window?.commitmentDate
                  ? formatDate(window.commitmentDate)
                  : 'Sin cuotas de billetera'}
            </p>
          </div>

          <ul className="space-y-1.5" aria-label="Contratos incluidos">
            {(window?.included ?? []).map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.loanName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Cuota {item.sequence} · {formatDate(item.dueDate)}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
              </li>
            ))}
          </ul>

          <ToggleField
            label="Ya pagado"
            helper="Marca las cuotas sin descontar una billetera."
            checked={external}
            onCheckedChange={setExternal}
          />

          {!external ? (
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
                        <WalletIdentity
                          name={wallet.name}
                          providerIconKey={wallet.provider_icon_key}
                          iconClassName="h-8 w-8 rounded-lg"
                        />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </GroupedRow>
            </div>
          ) : null}

          <DateStepper
            value={paidAt}
            onChange={setPaidAt}
          />

          <div className="space-y-1.5">
            <Label htmlFor="lender-pay-note">Nota (opcional)</Label>
            <Textarea
              id="lender-pay-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
            />
          </div>

          <Button
            type="submit"
            className={OVERLAY_PRIMARY_BUTTON_CLASS}
            disabled={submitting || !window?.canPay}
          >
            {submitting
              ? 'Guardando…'
              : external
                ? 'Registrar como ya pagado'
                : `Pagar ${formatCurrency(window?.amount ?? 0)}`}
          </Button>
        </form>
      )}
    </ResponsiveOverlay>
  );
}
