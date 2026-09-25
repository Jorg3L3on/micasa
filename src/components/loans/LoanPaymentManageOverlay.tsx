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
import { ToggleField } from '@/components/ui/toggle';
import { WalletIdentity } from '@/components/wallets/WalletIdentity';
import { useFinanceContext } from '@/context/finance-context';
import {
  applyLoanPaymentAction,
  batchUpdateLoanPayments,
} from '@/lib/api/loans';
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

const defaultItemWalletIds = (rows: LoanDuePaymentItem[]) =>
  Object.fromEntries(
    rows.map((item) => [item.id, defaultSourceWalletId(item)]),
  ) as Record<number, string>;

type PaymentWalletSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  fundingWallets: PaymentMethodOption[];
  allowNone: boolean;
  invalid?: boolean;
  ariaLabel: string;
  onOpenChange?: (open: boolean) => void;
};

const PaymentWalletSelect = ({
  value,
  onValueChange,
  fundingWallets,
  allowNone,
  invalid = false,
  ariaLabel,
  onOpenChange,
}: PaymentWalletSelectProps) => {
  const selectedWallet = fundingWallets.find(
    (wallet) => String(wallet.id) === value,
  );

  return (
    <Select
      value={value || (allowNone ? NO_PAYMENT_WALLET_VALUE : undefined)}
      onOpenChange={onOpenChange}
      onValueChange={(next) =>
        onValueChange(next === NO_PAYMENT_WALLET_VALUE ? '' : next)
      }
    >
      <SelectTrigger
        className={cn(
          OVERLAY_ROW_TRIGGER_CLASS,
          invalid && 'border-destructive focus:ring-destructive/30',
        )}
        aria-label={ariaLabel}
        aria-invalid={invalid}
      >
        <SelectValue placeholder="Selecciona">
          {selectedWallet ? (
            <WalletIdentity
              name={selectedWallet.name}
              providerIconKey={selectedWallet.provider_icon_key}
              iconClassName="h-8 w-8 rounded-lg"
            />
          ) : allowNone && !value ? (
            'Sin billetera'
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {allowNone ? (
          <SelectItem value={NO_PAYMENT_WALLET_VALUE}>Sin billetera</SelectItem>
        ) : null}
        {fundingWallets.map((wallet) => (
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
  );
};

type PaymentActionErrors = Partial<
  Record<'paidAt' | 'sourceWalletId' | 'general', string>
>;

type LoanPaymentManageOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LoanDuePaymentItem[];
  onSuccess?: () => Promise<void> | void;
};

const paymentActionLabel = (action: LoanPaymentActionValue) => {
  if (action === 'MARK_PAID') return 'Confirmar pago';
  if (action === 'MARK_PAID_EXTERNAL') return 'Registrar pago histórico';
  if (action === 'MARK_SCHEDULED') return 'Deshacer pago';
  if (action === 'SKIP') return 'Omitir pago';
  return 'Cancelar pago';
};

const paymentActionSuccessMessage = (
  action: LoanPaymentActionValue,
  count: number,
) => {
  if (action === 'MARK_PAID' || action === 'MARK_PAID_EXTERNAL') {
    return count > 1
      ? `${count} préstamos pagados exitosamente`
      : 'Préstamo pagado exitosamente';
  }
  if (action === 'MARK_SCHEDULED') {
    return count > 1 ? `${count} pagos deshechos` : 'Pago deshecho';
  }
  if (action === 'SKIP') {
    return count > 1 ? `${count} pagos omitidos` : 'Pago omitido';
  }
  return count > 1 ? `${count} pagos cancelados` : 'Pago cancelado';
};

const paymentActionDescription = (
  action: LoanPaymentActionValue,
  paymentSource: LoanDuePaymentItem['paymentSource'],
  count: number,
) => {
  const plural = count > 1;
  if (action === 'MARK_PAID') {
    return plural
      ? 'Cada contrato se descuenta de su billetera.'
      : 'Se descuenta de la billetera seleccionada.';
  }
  if (action === 'MARK_PAID_EXTERNAL') {
    return plural
      ? 'Se marcarán como pagados sin descontar de ninguna billetera ni crear gastos. Úsalo cuando los pagos ya se hicieron fuera de MiCasa.'
      : 'Se marcará como pagado sin descontar de ninguna billetera ni crear un gasto. Úsalo cuando el pago ya se hizo fuera de MiCasa.';
  }
  if (action === 'MARK_SCHEDULED') {
    return plural
      ? 'Se regresarán los pagos a por pagar y se revertirán los gastos o movimientos de billetera asociados.'
      : 'Se regresará el pago a por pagar y se revertirá el gasto vinculado o el movimiento de billetera asociado.';
  }
  if (action === 'SKIP') {
    return plural
      ? 'Omitir mantiene los adeudos pendientes para seguimiento y no genera salida de dinero.'
      : 'Omitir mantiene el adeudo pendiente para seguimiento y no genera salida de dinero.';
  }
  return plural
    ? 'Cancelar excluye estos pagos del calendario pagadero y no genera salida de dinero.'
    : 'Cancelar excluye este pago del calendario pagadero y no genera salida de dinero.';
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
  items,
  onSuccess,
}: LoanPaymentManageOverlayProps) => {
  const { context } = useFinanceContext();
  const [wallets, setWallets] = useState<PaymentMethodOption[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(false);
  const [action, setAction] = useState<LoanPaymentActionValue | null>(null);
  const [paidAt, setPaidAt] = useState('');
  const [sourceWalletId, setSourceWalletId] = useState('');
  const [itemWalletIds, setItemWalletIds] = useState<Record<number, string>>(
    {},
  );
  const [useSameWallet, setUseSameWallet] = useState(true);
  const [errors, setErrors] = useState<PaymentActionErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const primary = items[0] ?? null;
  const isGroup = items.length > 1;
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const itemKey = items.map((item) => item.id).join(',');
  const fundingWallets = wallets.filter(
    (wallet) => wallet.type === 'CASH' || wallet.type === 'DEBIT_CARD',
  );
  const isPayrollDeduction = primary?.paymentSource === 'PAYROLL_DEDUCTION';
  const allScheduled = items.every((item) => item.status === 'SCHEDULED');
  const allPaid = items.every((item) => item.status === 'PAID');
  const showWalletControls =
    isGroup && allScheduled && (action == null || action === 'MARK_PAID');

  useEffect(() => {
    if (!open || items.length === 0) return;

    const walletsByItem = defaultItemWalletIds(items);
    const selected = Object.values(walletsByItem).filter(Boolean);
    const sharesWallet =
      selected.length === items.length && new Set(selected).size === 1;
    setAction(null);
    setPaidAt(items[0].paidAt ?? items[0].dueDate);
    setSourceWalletId(sharesWallet ? selected[0]! : defaultSourceWalletId(items[0]));
    setItemWalletIds(walletsByItem);
    setUseSameWallet(sharesWallet);
    setErrors({});
  }, [open, itemKey]);

  useEffect(() => {
    if (!open) return;

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
  }, [open, context]);

  const handleSelectAction = (next: LoanPaymentActionValue) => {
    setAction(next);
    setErrors({});
  };

  const validate = (): PaymentActionErrors => {
    if (!primary || !action) {
      return { general: 'Selecciona una acción para continuar.' };
    }

    const nextErrors: PaymentActionErrors = {};
    if (action === 'MARK_PAID' || action === 'MARK_PAID_EXTERNAL') {
      if (!isValidCalendarDateString(paidAt)) {
        nextErrors.paidAt = 'Selecciona una fecha de pago válida.';
      }
      if (action === 'MARK_PAID') {
        if (isGroup && !useSameWallet) {
          if (items.some((item) => !itemWalletIds[item.id])) {
            nextErrors.sourceWalletId =
              'Selecciona una billetera para cada contrato.';
          }
        } else if (!sourceWalletId) {
          nextErrors.sourceWalletId = isGroup
            ? 'Selecciona la billetera que pagará estos préstamos.'
            : 'Selecciona la billetera que pagará este préstamo.';
        }
      }
    }
    return nextErrors;
  };

  const handleSubmit = async () => {
    if (!primary || !action || items.length === 0) return;
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

      const walletIdForItem = (item: LoanDuePaymentItem) =>
        useSameWallet ? sourceWalletId : (itemWalletIds[item.id] ?? '');

      if (items.length > 1 && action === 'MARK_PAID') {
        const resolvedWalletIds = items.map((item) => walletIdForItem(item));
        const uniqueWalletIds = [...new Set(resolvedWalletIds)];
        if (uniqueWalletIds.length === 1) {
          await batchUpdateLoanPayments(
            {
              paymentIds: items.map((item) => item.id),
              action,
              paidAt,
              sourceWalletId: uniqueWalletIds[0]
                ? Number(uniqueWalletIds[0])
                : undefined,
            },
            context,
          );
        } else {
          for (const item of items) {
            const walletId = walletIdForItem(item);
            await applyLoanPaymentAction(
              item.id,
              {
                action,
                paidAt,
                ...(walletId ? { sourceWalletId: Number(walletId) } : {}),
              },
              context,
            );
          }
        }
      } else if (items.length > 1 && action === 'MARK_PAID_EXTERNAL') {
        await batchUpdateLoanPayments(
          {
            paymentIds: items.map((item) => item.id),
            action,
            paidAt: payload.paidAt ?? undefined,
          },
          context,
        );
      } else if (items.length > 1) {
        for (const item of items) {
          await applyLoanPaymentAction(item.id, { action }, context);
        }
      } else {
        await applyLoanPaymentAction(primary.id, payload, context);
      }
      toast.success(paymentActionSuccessMessage(action, items.length));
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

  const title = !primary
    ? 'Gestionar préstamo'
    : isGroup
      ? isPayrollDeduction
        ? `Nómina · ${primary.lender}`
        : `Pagar a ${primary.lender}`
      : primary.loanName;
  const description = !primary
    ? 'Opciones de este pago de préstamo'
    : isGroup
      ? `${items.length} contratos · vence ${formatDate(primary.dueDate)}`
      : `${primary.lender} · vence ${formatDate(primary.dueDate)}`;

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
        primary ? (
          <div className="flex flex-col gap-3">
            <p className="px-1 text-xs text-muted-foreground">
              {isGroup ? 'Compromiso del periodo' : `Pago #${primary.sequence}`}
              {': '}
              <span className="font-mono font-semibold tabular-nums text-foreground">
                {formatCurrency(isGroup ? totalAmount : primary.amount)}
              </span>
              {' · '}
              {isGroup
                ? `${items.length} contratos · ${formatDate(primary.dueDate)}`
                : `${primary.lender} · ${formatDate(primary.dueDate)}`}
              {!isGroup && primary.paymentSource === 'PAYROLL_DEDUCTION'
                ? ` · Se descuenta del ingreso${primary.incomeTemplateName ? ` · ${primary.incomeTemplateName}` : ''}`
                : !isGroup && primary.sourceWalletName
                  ? ` · ${primary.sourceWalletName}`
                  : ''}
            </p>

            {isGroup ? (
              <>
                {!loadingWallets && showWalletControls ? (
                  <>
                    <ToggleField
                      label="Pagar con la misma billetera"
                      helper="Si lo desactivas, elige una billetera por contrato."
                      checked={useSameWallet}
                      onCheckedChange={setUseSameWallet}
                    />
                    {useSameWallet ? (
                      <div className={OVERLAY_GROUPED_CARD_CLASS}>
                        <GroupedRow label="Billetera">
                          <PaymentWalletSelect
                            value={sourceWalletId}
                            onValueChange={setSourceWalletId}
                            fundingWallets={fundingWallets}
                            allowNone={false}
                            invalid={Boolean(errors.sourceWalletId)}
                            ariaLabel="Billetera que pagará estos préstamos"
                            onOpenChange={handleSelectOpenChange}
                          />
                        </GroupedRow>
                      </div>
                    ) : null}
                  </>
                ) : null}
                <ul className="space-y-1.5" aria-label="Contratos incluidos">
                  {items.map((item) => {
                    const showItemWallet =
                      !loadingWallets && showWalletControls && !useSameWallet;
                    return (
                      <li
                        key={item.id}
                        className={
                          showItemWallet
                            ? OVERLAY_GROUPED_CARD_CLASS
                            : 'flex items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm'
                        }
                      >
                        <div
                          className={cn(
                            'flex items-center justify-between gap-2',
                            showItemWallet ? 'px-3 py-2' : 'contents',
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {item.loanName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Cuota {item.sequence} · {formatDate(item.dueDate)}
                            </p>
                          </div>
                          <span className="font-mono text-sm font-semibold tabular-nums">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                        {showItemWallet ? (
                          <GroupedRow label="Billetera">
                            <PaymentWalletSelect
                              value={itemWalletIds[item.id] ?? ''}
                              onValueChange={(value) =>
                                setItemWalletIds((current) => ({
                                  ...current,
                                  [item.id]: value,
                                }))
                              }
                              fundingWallets={fundingWallets}
                              allowNone={false}
                              invalid={
                                Boolean(errors.sourceWalletId) &&
                                !itemWalletIds[item.id]
                              }
                              ariaLabel={`Billetera de ${item.loanName}`}
                              onOpenChange={handleSelectOpenChange}
                            />
                          </GroupedRow>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}

            {loadingWallets ? (
              <div className="flex justify-center py-6">
                <Loader2
                  className="h-6 w-6 animate-spin text-muted-foreground"
                  data-icon="inline-start"
                />
              </div>
            ) : action == null ? (
              allScheduled ? (
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    className={OVERLAY_PRIMARY_BUTTON_CLASS}
                    onClick={() => handleSelectAction('MARK_PAID')}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Pagar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full justify-center gap-1.5"
                    onClick={() => handleSelectAction('MARK_PAID_EXTERNAL')}
                    aria-label={
                      isGroup
                        ? 'Registrar pagos históricos sin mover billetera'
                        : 'Registrar pago histórico sin mover billetera'
                    }
                  >
                    <History className="h-4 w-4" aria-hidden />
                    Ya pagado
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full justify-center gap-1.5 text-muted-foreground"
                    onClick={() => handleSelectAction('SKIP')}
                  >
                    <CircleSlash className="h-4 w-4" aria-hidden />
                    Omitir
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full justify-center gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => handleSelectAction('CANCEL')}
                  >
                    <CircleSlash className="h-4 w-4" aria-hidden />
                    Cancelar pago
                  </Button>
                </div>
              ) : allPaid ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-center gap-1.5"
                  onClick={() => handleSelectAction('MARK_SCHEDULED')}
                >
                  <Undo2 className="h-4 w-4" aria-hidden />
                  Deshacer pago
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isGroup
                    ? 'Estos pagos ya no están pendientes.'
                    : 'Este pago ya no está pendiente.'}
                </p>
              )
            ) : (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {paymentActionLabel(action)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {paymentActionDescription(
                      action,
                      primary.paymentSource,
                      items.length,
                    )}
                  </p>
                </div>

                {action === 'MARK_PAID' || action === 'MARK_PAID_EXTERNAL' ? (
                  <div className={OVERLAY_GROUPED_CARD_CLASS}>
                    <GroupedRow label="Fecha">
                      <DateStepper value={paidAt} onChange={setPaidAt} />
                    </GroupedRow>
                    {action === 'MARK_PAID' && !isGroup ? (
                      <GroupedRow label="Billetera">
                        <PaymentWalletSelect
                          value={sourceWalletId}
                          onValueChange={setSourceWalletId}
                          fundingWallets={fundingWallets}
                          allowNone={false}
                          invalid={Boolean(errors.sourceWalletId)}
                          ariaLabel="Billetera que pagará el préstamo"
                          onOpenChange={handleSelectOpenChange}
                        />
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

                <Button
                  type="button"
                  className={OVERLAY_PRIMARY_BUTTON_CLASS}
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                >
                  {submitting ? 'Guardando…' : 'Guardar'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full"
                  onClick={() => {
                    setAction(null);
                    setErrors({});
                  }}
                  disabled={submitting}
                >
                  Volver
                </Button>
              </div>
            )}
          </div>
        ) : null
      }
    </ResponsiveOverlay>
  );
};
