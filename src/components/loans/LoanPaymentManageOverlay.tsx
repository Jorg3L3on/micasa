'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleSlash,
  History,
  Loader2,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  DateStepper,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_TRIGGER_CLASS,
} from '@/components/overlay/overlay-form';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { useFinanceContext } from '@/context/finance-context';
import { applyLoanPaymentAction } from '@/lib/api/loans';
import { getPaymentMethodOptions } from '@/lib/api/wallets';
import { isValidCalendarDateString } from '@/lib/calendar-dates';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { PaymentMethodOption } from '@/types/catalog';
import type { LoanDuePaymentItem, LoanPaymentActionValue } from '@/types/loans';

const NO_PAYMENT_WALLET_VALUE = 'none';

const defaultSourceWalletId = (item: LoanDuePaymentItem): string => {
  const walletId = item.sourceWalletId ?? item.linkedWalletId;
  return walletId ? String(walletId) : '';
};

type PaymentActionErrors = Partial<
  Record<'paidAt' | 'sourceWalletId' | 'general', string>
>;

type LoanPaymentManageOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: LoanDuePaymentItem | null;
  onSuccess?: () => Promise<void> | void;
};

const paymentActionLabel = (action: LoanPaymentActionValue) => {
  if (action === 'MARK_PAID') return 'Confirmar pago';
  if (action === 'MARK_PAID_EXTERNAL') return 'Registrar pago histórico';
  if (action === 'MARK_SCHEDULED') return 'Deshacer pago';
  if (action === 'SKIP') return 'Omitir pago';
  return 'Cancelar pago';
};

const paymentActionSuccessMessage = (action: LoanPaymentActionValue) => {
  if (action === 'MARK_PAID' || action === 'MARK_PAID_EXTERNAL') {
    return 'Préstamo pagado exitosamente';
  }
  if (action === 'MARK_SCHEDULED') return 'Pago deshecho';
  if (action === 'SKIP') return 'Pago omitido';
  return 'Pago cancelado';
};

const paymentActionDescription = (
  action: LoanPaymentActionValue,
  paymentSource: LoanDuePaymentItem['paymentSource'],
) => {
  if (action === 'MARK_PAID') {
    return paymentSource === 'PAYROLL_DEDUCTION'
      ? 'Se marcará como pagado. Si eliges billetera, se generará un gasto vinculado contra esa billetera.'
      : 'Se marcará como pagado y se generará el gasto vinculado contra la billetera seleccionada.';
  }
  if (action === 'MARK_PAID_EXTERNAL') {
    return 'Se marcará como pagado sin descontar de ninguna billetera ni crear un gasto. Úsalo cuando el pago ya se hizo fuera de MiCasa.';
  }
  if (action === 'MARK_SCHEDULED') {
    return 'Se regresará el pago a por pagar y se revertirá el gasto vinculado o el movimiento de billetera asociado.';
  }
  if (action === 'SKIP') {
    return 'Omitir mantiene el adeudo pendiente para seguimiento y no genera salida de dinero.';
  }
  return 'Cancelar excluye este pago del calendario pagadero y no genera salida de dinero.';
};

const mapPaymentActionError = (message: string): PaymentActionErrors => {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('billetera') ||
    normalized.includes('saldo insuficiente') ||
    normalized.includes('débito') ||
    normalized.includes('debito') ||
    normalized.includes('efectivo')
  ) {
    return { sourceWalletId: message };
  }
  if (normalized.includes('fecha')) {
    return { paidAt: message };
  }
  return { general: message };
};

export const LoanPaymentManageOverlay = ({
  open,
  onOpenChange,
  item,
  onSuccess,
}: LoanPaymentManageOverlayProps) => {
  const { context } = useFinanceContext();
  const [wallets, setWallets] = useState<PaymentMethodOption[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [action, setAction] = useState<LoanPaymentActionValue | null>(null);
  const [paidAt, setPaidAt] = useState('');
  const [sourceWalletId, setSourceWalletId] = useState('');
  const [errors, setErrors] = useState<PaymentActionErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const fundingWallets = wallets.filter(
    (wallet) => wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD',
  );
  const isPayrollDeduction = item?.paymentSource === 'PAYROLL_DEDUCTION';
  const selectedWallet = fundingWallets.find(
    (wallet) => String(wallet.id) === sourceWalletId,
  );

  useEffect(() => {
    if (!open || !item) return;

    setAction(null);
    setPaidAt(item.paidAt ?? item.dueDate);
    setSourceWalletId(defaultSourceWalletId(item));
    setErrors({});

    let cancelled = false;
    setLoadingWallets(true);
    getPaymentMethodOptions(context)
      .then((options) => {
        if (!cancelled) setWallets(options);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(
          error instanceof Error
            ? error.message
            : 'No se pudieron cargar las billeteras',
        );
        setWallets([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingWallets(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, item, context]);

  const handleSelectAction = (next: LoanPaymentActionValue) => {
    setAction(next);
    setErrors({});
  };

  const validate = (): PaymentActionErrors => {
    if (!item || !action) {
      return { general: 'Selecciona una acción para continuar.' };
    }

    const nextErrors: PaymentActionErrors = {};
    if (action === 'MARK_PAID' || action === 'MARK_PAID_EXTERNAL') {
      if (!isValidCalendarDateString(paidAt)) {
        nextErrors.paidAt = 'Selecciona una fecha de pago válida.';
      }
      if (action === 'MARK_PAID' && !isPayrollDeduction && !sourceWalletId) {
        nextErrors.sourceWalletId =
          'Selecciona la billetera que pagará este préstamo.';
      }
    }
    return nextErrors;
  };

  const handleSubmit = async () => {
    if (!item || !action) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    setErrors({});
    try {
      const payload: Parameters<typeof applyLoanPaymentAction>[1] = {
        action,
      };
      if (action === 'MARK_PAID') {
        payload.paidAt = paidAt;
        if (sourceWalletId) {
          payload.sourceWalletId = Number(sourceWalletId);
        }
      }
      if (action === 'MARK_PAID_EXTERNAL') {
        payload.paidAt = paidAt;
      }

      await applyLoanPaymentAction(item.id, payload, context);
      toast.success(paymentActionSuccessMessage(action));
      onOpenChange(false);
      if (onSuccess) await onSuccess();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar el pago del préstamo';
      setErrors(mapPaymentActionError(message));
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const title = item?.loanName ?? 'Gestionar préstamo';
  const description = item
    ? `${item.lender} · vence ${formatDate(item.dueDate)}`
    : 'Opciones de este pago de préstamo';

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      busy={submitting}
      contentClassName="sm:max-w-lg"
    >
      {({ handleSelectOpenChange }) =>
        item ? (
          <div className="flex flex-col gap-3">
            <div className={OVERLAY_GROUPED_CARD_CLASS}>
              <div className="space-y-1 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Pago #{item.sequence}
                </p>
                <p className="font-mono text-2xl font-bold tabular-nums">
                  {formatCurrency(item.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.lender} · {formatDate(item.dueDate)}
                  {item.paymentSource === 'PAYROLL_DEDUCTION'
                    ? ` · Nómina${item.incomeTemplateName ? `: ${item.incomeTemplateName}` : ''}`
                    : item.sourceWalletName
                      ? ` · ${item.sourceWalletName}`
                      : ''}
                </p>
              </div>
            </div>

            {loadingWallets ? (
              <div className="flex justify-center py-6">
                <Loader2
                  className="h-6 w-6 animate-spin text-muted-foreground"
                  data-icon="inline-start"
                />
              </div>
            ) : action == null ? (
              item.status === 'SCHEDULED' ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 justify-center gap-1.5"
                    onClick={() => handleSelectAction('MARK_PAID')}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Pagar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 justify-center gap-1.5"
                    onClick={() => handleSelectAction('MARK_PAID_EXTERNAL')}
                    aria-label="Registrar pago histórico sin mover billetera"
                  >
                    <History className="h-4 w-4" aria-hidden />
                    Ya pagado
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 justify-center gap-1.5 text-muted-foreground"
                    onClick={() => handleSelectAction('SKIP')}
                  >
                    <CircleSlash className="h-4 w-4" aria-hidden />
                    Omitir
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 justify-center gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => handleSelectAction('CANCEL')}
                  >
                    <CircleSlash className="h-4 w-4" aria-hidden />
                    Cancelar
                  </Button>
                </div>
              ) : item.status === 'PAID' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 justify-center gap-1.5"
                  onClick={() => handleSelectAction('MARK_SCHEDULED')}
                >
                  <Undo2 className="h-4 w-4" aria-hidden />
                  Deshacer pago
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Este pago ya no está pendiente.
                </p>
              )
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {paymentActionLabel(action)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {paymentActionDescription(action, item.paymentSource)}
                  </p>
                </div>

                {action === 'MARK_PAID' || action === 'MARK_PAID_EXTERNAL' ? (
                  <div className={OVERLAY_GROUPED_CARD_CLASS}>
                    <GroupedRow label="Fecha">
                      <DateStepper value={paidAt} onChange={setPaidAt} />
                    </GroupedRow>
                    {action === 'MARK_PAID' ? (
                      <GroupedRow label="Billetera">
                        <Select
                          value={
                            sourceWalletId ||
                            (isPayrollDeduction ? NO_PAYMENT_WALLET_VALUE : undefined)
                          }
                          onOpenChange={handleSelectOpenChange}
                          onValueChange={(value) =>
                            setSourceWalletId(
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
                                  providerIconKey={
                                    selectedWallet.provider_icon_key
                                  }
                                  iconClassName="h-8 w-8 rounded-lg"
                                />
                              ) : isPayrollDeduction && !sourceWalletId ? (
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
                            {fundingWallets.map((wallet) => (
                              <SelectItem
                                key={wallet.id}
                                value={String(wallet.id)}
                              >
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
                    ) : null}
                  </div>
                ) : null}

                {errors.paidAt ? (
                  <p className="text-xs text-destructive" role="alert">
                    {errors.paidAt}
                  </p>
                ) : null}
                {errors.sourceWalletId ? (
                  <p className="text-xs text-destructive" role="alert">
                    {errors.sourceWalletId}
                  </p>
                ) : null}

                {errors.general ? (
                  <div
                    className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                    role="alert"
                  >
                    {errors.general}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    onClick={() => {
                      setAction(null);
                      setErrors({});
                    }}
                    disabled={submitting}
                  >
                    Volver
                  </Button>
                  <Button
                    type="button"
                    className={OVERLAY_PRIMARY_BUTTON_CLASS}
                    onClick={() => void handleSubmit()}
                    disabled={submitting}
                  >
                    {submitting ? 'Guardando…' : 'Aplicar'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null
      }
    </ResponsiveOverlay>
  );
};
