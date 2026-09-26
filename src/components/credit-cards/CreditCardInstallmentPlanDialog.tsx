'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleField } from '@/components/ui/toggle';
import type { FinanceContextType } from '@/types/finance-context';
import type { CreditCardInstallmentPlanItem } from '@/types/catalog';
import {
  createCreditCardInstallmentPlan,
  updateCreditCardInstallmentPlan,
} from '@/lib/api/credit-cards';
import { getInstallmentPlanFormValues } from '@/components/credit-cards/installment-plan-form-values';
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

type CreditCardInstallmentPlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creditCardId: number;
  context: FinanceContextType;
  defaultDueDay?: number | null;
  plan?: CreditCardInstallmentPlanItem | null;
  onSuccess: () => void | Promise<void>;
};

/**
 * Form body remounts via `key` from the parent whenever create/edit target changes,
 * so useState initializers always match the selected plan (no empty create flash).
 */
export const CreditCardInstallmentPlanDialog = ({
  open,
  onOpenChange,
  creditCardId,
  context,
  defaultDueDay,
  plan = null,
  onSuccess,
}: CreditCardInstallmentPlanDialogProps) => {
  const isEditing = plan != null;
  const initial = getInstallmentPlanFormValues(plan, defaultDueDay);

  const [name, setName] = useState(initial.name);
  const [installmentAmount, setInstallmentAmount] = useState(
    initial.installmentAmount,
  );
  const [totalInstallments, setTotalInstallments] = useState(
    initial.totalInstallments,
  );
  const [paidInstallments, setPaidInstallments] = useState(
    initial.paidInstallments,
  );
  const [nextDueDate, setNextDueDate] = useState(initial.nextDueDate);
  const [alreadyInBalance, setAlreadyInBalance] = useState(
    initial.alreadyInBalance,
  );
  const [issuerRemainingBalance, setIssuerRemainingBalance] = useState(
    initial.issuerRemainingBalance,
  );
  const [submitting, setSubmitting] = useState(false);

  const parsedTotal = Number.parseInt(totalInstallments.trim(), 10);
  const parsedPaid = Number.parseInt(paidInstallments.trim(), 10);
  const remainingInstallments = useMemo(() => {
    if (!Number.isFinite(parsedTotal) || !Number.isFinite(parsedPaid)) return null;
    return Math.max(parsedTotal - parsedPaid, 0);
  }, [parsedPaid, parsedTotal]);

  const nextInstallmentNumber = useMemo(() => {
    if (!Number.isFinite(parsedPaid)) return null;
    return parsedPaid + 1;
  }, [parsedPaid]);

  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      toast.error('Indica el nombre de la compra');
      return;
    }
    if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) {
      toast.error('Indica un monto de cuota válido');
      return;
    }
    if (!Number.isFinite(parsedTotal) || parsedTotal < 2) {
      toast.error('Indica al menos 2 meses');
      return;
    }
    if (!Number.isFinite(parsedPaid) || parsedPaid < 0 || parsedPaid >= parsedTotal) {
      toast.error('Las cuotas pagadas deben ser de 0 a total − 1');
      return;
    }
    if (!nextDueDate) {
      toast.error('Indica la fecha de la próxima cuota');
      return;
    }

    const payload = {
      name: name.trim(),
      installment_amount: installmentAmount,
      total_installments: parsedTotal,
      paid_installments: parsedPaid,
      next_due_date: nextDueDate,
      already_in_card_balance: alreadyInBalance,
      issuer_remaining_balance:
        issuerRemainingBalance > 0 ? issuerRemainingBalance : null,
    };

    try {
      setSubmitting(true);
      if (isEditing && plan) {
        await updateCreditCardInstallmentPlan(
          creditCardId,
          plan.id,
          payload,
          context,
        );
        toast.success('Plan actualizado');
      } else {
        await createCreditCardInstallmentPlan(creditCardId, payload, context);
        toast.success('Plan de cuotas creado');
      }
      onOpenChange(false);
      await onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : isEditing
            ? 'No se pudo actualizar el plan'
            : 'No se pudo crear el plan',
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    alreadyInBalance,
    issuerRemainingBalance,
    context,
    creditCardId,
    installmentAmount,
    isEditing,
    name,
    nextDueDate,
    onOpenChange,
    onSuccess,
    parsedPaid,
    parsedTotal,
    plan,
  ]);

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? 'Editar plan a meses' : 'Plan de compra a meses'}
      description={
        isEditing
          ? 'Corrige el nombre, monto o progreso sin borrar el plan ni duplicar la deuda.'
          : 'Registra una compra MSI con nombre y progreso. Las cuotas futuras se generan solas; no tienes que capturar cada mes a mano.'
      }
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
          <GroupedRow label="Nombre">
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Laptop"
              aria-label="Nombre de la compra"
              autoCapitalize="sentences"
              autoComplete="off"
              className={OVERLAY_ROW_INPUT_CLASS}
            />
          </GroupedRow>

          <AmountRow
            id="plan-amount"
            label="Monto por cuota"
            value={installmentAmount}
            onChange={setInstallmentAmount}
            ariaLabel="Monto de cada cuota"
          />

          <GroupedRow label="Meses">
            <Input
              id="plan-total"
              type="number"
              min={2}
              max={60}
              inputMode="numeric"
              placeholder="Total"
              value={totalInstallments}
              onChange={(e) => setTotalInstallments(e.target.value)}
              aria-label="Total de meses del plan"
              className={OVERLAY_ROW_INPUT_CLASS}
            />
          </GroupedRow>

          <GroupedRow label="Pagadas">
            <Input
              id="plan-paid"
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="0"
              value={paidInstallments}
              onChange={(e) => setPaidInstallments(e.target.value)}
              aria-label="Cuotas ya pagadas al dar de alta"
              className={OVERLAY_ROW_INPUT_CLASS}
            />
          </GroupedRow>

          <GroupedRow label="Próxima">
            <DateStepper value={nextDueDate} onChange={setNextDueDate} />
          </GroupedRow>
        </div>

        {nextInstallmentNumber != null && remainingInstallments != null ? (
          <div
            className="rounded-xl border border-border/60 px-3 py-2 text-xs"
            role="status"
          >
            <p className="font-medium text-foreground">
              Progreso: {nextInstallmentNumber} de {parsedTotal || '—'}
            </p>
            <p className="mt-1 text-muted-foreground">
              {isEditing ? 'Quedan' : 'Se crearán'} {remainingInstallments} cuota
              {remainingInstallments === 1 ? '' : 's'}{' '}
              {isEditing ? 'pendiente' : 'futura'}
              {remainingInstallments === 1 ? '' : 's'}
              {installmentAmount > 0
                ? ` · mensualidad ${formatCurrency(installmentAmount)}`
                : ''}
              {issuerRemainingBalance > 0
                ? ` · saldo del plan ${formatCurrency(issuerRemainingBalance)}`
                : ''}
            </p>
            <p className="mt-1 text-muted-foreground">
              Este corte solo incluye la mensualidad. El saldo del plan es
              informativo.
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <div className={OVERLAY_GROUPED_CARD_CLASS}>
            <AmountRow
              id="plan-remaining"
              label="Saldo del plan (emisor)"
              value={issuerRemainingBalance}
              onChange={setIssuerRemainingBalance}
              ariaLabel="Saldo restante del plan según el emisor"
              enterKeyHint="done"
            />
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            Opcional. Si el emisor trae centavos distintos, la última cuota los
            absorbe. No se cobra el saldo completo en este corte.
          </p>
        </div>

        <ToggleField
          layout="row"
          className="px-3"
          label="Ya está en el saldo de la tarjeta"
          helper="Actívalo si registras la compra tarde y el estado de cuenta ya incluye el monto. No volverá a subir la deuda."
          checked={alreadyInBalance}
          onCheckedChange={setAlreadyInBalance}
          aria-label="Ya está en el saldo de la tarjeta"
        />

        <Button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className={OVERLAY_PRIMARY_BUTTON_CLASS}
        >
          {submitting ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear plan'}
        </Button>
      </form>
    </ResponsiveOverlay>
  );
};
