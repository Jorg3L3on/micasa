'use client';

import { Loader2 } from 'lucide-react';
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
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { PaymentMethodOption } from '@/types/catalog';
import type {
  LoanListItem,
  LoanPaymentActionValue,
  LoanPaymentListItem,
} from '@/types/loans';

const NO_PAYMENT_WALLET_VALUE = 'none';

export type LoanCalendarPaymentDraft = {
  paymentId: number;
  action: LoanPaymentActionValue;
  paidAt: string;
  sourceWalletId: string;
  note: string;
};

type LoanCalendarPaymentOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanListItem | null;
  payment: LoanPaymentListItem | null;
  draft: LoanCalendarPaymentDraft | null;
  errors: Partial<Record<'paidAt' | 'sourceWalletId' | 'note' | 'general', string>>;
  submitting: boolean;
  fundingWallets: PaymentMethodOption[];
  onFieldChange: <K extends keyof LoanCalendarPaymentDraft>(
    key: K,
    value: LoanCalendarPaymentDraft[K],
  ) => void;
  onSubmit: () => void;
};

const paymentActionLabel = (action: LoanPaymentActionValue) => {
  if (action === 'MARK_PAID') return 'Confirmar pago';
  if (action === 'MARK_PAID_EXTERNAL') return 'Registrar pago histórico';
  if (action === 'MARK_SCHEDULED') return 'Deshacer pago';
  if (action === 'SKIP') return 'Omitir pago';
  return 'Cancelar pago';
};

const paymentActionDescription = (
  action: LoanPaymentActionValue,
  paymentSource: LoanListItem['paymentSource'],
) => {
  if (action === 'MARK_PAID') {
    return paymentSource === 'PAYROLL_DEDUCTION'
      ? 'Se marcará como pagado. Si eliges billetera, se generará un gasto vinculado contra esa billetera.'
      : 'Se marcará como pagado y se generará el gasto vinculado contra la billetera seleccionada.';
  }
  if (action === 'MARK_PAID_EXTERNAL') {
    return 'Se marcará como pagado sin descontar de ninguna billetera ni crear un gasto. Úsalo cuando el pago ya se hizo fuera de MiCasa (banco, Mercado Libre, etc.).';
  }
  if (action === 'MARK_SCHEDULED') {
    return 'Se regresará el pago a por pagar y se revertirá el gasto vinculado o el movimiento de billetera asociado.';
  }
  if (action === 'SKIP') {
    return 'Omitir mantiene el adeudo pendiente para seguimiento y no genera salida de dinero.';
  }
  return 'Cancelar excluye este pago del calendario pagadero y no genera salida de dinero.';
};

const submitLabel = (
  action: LoanPaymentActionValue,
  amount: number,
) => {
  if (action === 'MARK_PAID') return `Pagar ${formatCurrency(amount)}`;
  return paymentActionLabel(action);
};

export const LoanCalendarPaymentOverlay = ({
  open,
  onOpenChange,
  loan,
  payment,
  draft,
  errors,
  submitting,
  fundingWallets,
  onFieldChange,
  onSubmit,
}: LoanCalendarPaymentOverlayProps) => {
  const isPayrollDeduction = loan?.paymentSource === 'PAYROLL_DEDUCTION';
  const walletOptions = (() => {
    if (!draft?.sourceWalletId) return fundingWallets;
    if (fundingWallets.some((wallet) => String(wallet.id) === draft.sourceWalletId)) {
      return fundingWallets;
    }
    const fallbackName =
      payment?.sourceWalletName ??
      (loan?.sourceWalletId != null &&
      String(loan.sourceWalletId) === draft.sourceWalletId
        ? loan.sourceWalletName
        : null) ??
      (loan?.linkedWalletId != null &&
      String(loan.linkedWalletId) === draft.sourceWalletId
        ? loan.linkedWalletName
        : null) ??
      'Billetera';
    return [
      {
        id: Number(draft.sourceWalletId),
        name: fallbackName,
        type: 'DEBIT_CARD',
        amount: 0,
      } satisfies PaymentMethodOption,
      ...fundingWallets,
    ];
  })();
  const selectedWallet = walletOptions.find(
    (wallet) => String(wallet.id) === draft?.sourceWalletId,
  );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={draft ? paymentActionLabel(draft.action) : 'Confirmar pago'}
      description={
        loan && draft
          ? paymentActionDescription(draft.action, loan.paymentSource)
          : 'Confirma la acción de este pago.'
      }
      busy={submitting}
      contentClassName="sm:max-w-lg"
    >
      {({ handleSelectOpenChange }) =>
        loan && payment && draft ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onSubmit();
            }}
            className="flex flex-col gap-3"
            aria-busy={submitting}
          >
            <div className="rounded-xl border border-border/60 bg-card px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Pago #{payment.sequence}
              </p>
              <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                {formatCurrency(payment.amount)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {loan.name} · {formatDate(payment.dueDate)}
                {isPayrollDeduction
                  ? ` · Nómina${loan.incomeTemplateName ? `: ${loan.incomeTemplateName}` : ''}`
                  : payment.sourceWalletName || loan.sourceWalletName
                    ? ` · ${payment.sourceWalletName ?? loan.sourceWalletName}`
                    : ''}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              {paymentActionDescription(draft.action, loan.paymentSource)}
            </p>

            {draft.action === 'MARK_PAID' ||
            draft.action === 'MARK_PAID_EXTERNAL' ? (
              <DateStepper
                value={draft.paidAt}
                onChange={(next) => onFieldChange('paidAt', next)}
              />
            ) : null}
            {errors.paidAt ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.paidAt}
              </p>
            ) : null}

            {draft.action === 'MARK_PAID' ? (
              <div className={OVERLAY_GROUPED_CARD_CLASS}>
                <GroupedRow label="Billetera">
                  <Select
                    value={
                      draft.sourceWalletId ||
                      (isPayrollDeduction ? NO_PAYMENT_WALLET_VALUE : undefined)
                    }
                    onOpenChange={handleSelectOpenChange}
                    onValueChange={(value) =>
                      onFieldChange(
                        'sourceWalletId',
                        value === NO_PAYMENT_WALLET_VALUE ? '' : value,
                      )
                    }
                  >
                    <SelectTrigger
                      className={cn(
                        OVERLAY_ROW_TRIGGER_CLASS,
                        errors.sourceWalletId &&
                          'border-destructive focus:ring-destructive/30',
                      )}
                      aria-label="Billetera que pagará el préstamo"
                      aria-invalid={Boolean(errors.sourceWalletId)}
                    >
                      <SelectValue placeholder="Selecciona">
                        {selectedWallet ? (
                          <WalletIdentity
                            name={selectedWallet.name}
                            providerIconKey={selectedWallet.provider_icon_key}
                            iconClassName="h-8 w-8 rounded-lg"
                          />
                        ) : isPayrollDeduction && !draft.sourceWalletId ? (
                          'Sin billetera'
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {isPayrollDeduction ? (
                        <SelectItem value={NO_PAYMENT_WALLET_VALUE}>
                          Sin billetera
                        </SelectItem>
                      ) : null}
                      {walletOptions.map((wallet) => (
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
              </div>
            ) : null}
            {isPayrollDeduction && draft.action === 'MARK_PAID' ? (
              <p className="text-[11px] text-muted-foreground">
                Déjalo sin billetera para registrar solo la deducción de nómina.
              </p>
            ) : null}
            {errors.sourceWalletId ? (
              <p className="text-xs text-destructive" role="alert">
                {errors.sourceWalletId}
              </p>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="loan-calendar-payment-note">Nota (opcional)</Label>
              <Textarea
                id="loan-calendar-payment-note"
                value={draft.note}
                onChange={(event) => onFieldChange('note', event.target.value)}
                placeholder="Motivo o referencia del cambio"
                rows={2}
              />
            </div>

            {errors.general ? (
              <div
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                role="alert"
              >
                {errors.general}
              </div>
            ) : null}

            <Button
              type="submit"
              className={OVERLAY_PRIMARY_BUTTON_CLASS}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden
                    data-icon="inline-start"
                  />
                  Guardando…
                </>
              ) : (
                submitLabel(draft.action, payment.amount)
              )}
            </Button>
          </form>
        ) : null
      }
    </ResponsiveOverlay>
  );
};
