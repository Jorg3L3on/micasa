'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { ToggleField } from '@/components/ui/toggle';
import type { FinanceContextType } from '@/types/finance-context';
import type { CreditCardInstallmentPlanItem } from '@/types/catalog';
import {
  createCreditCardInstallmentPlan,
  updateCreditCardInstallmentPlan,
} from '@/lib/api/credit-cards';
import { getInstallmentPlanFormValues } from '@/components/credit-cards/installment-plan-form-values';
import { cn, formatCurrency } from '@/lib/utils';

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar plan de compra a meses' : 'Plan de compra a meses'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Corrige el nombre, monto o progreso sin borrar el plan ni duplicar la deuda.'
              : 'Registra una compra MSI con nombre y progreso. Las cuotas futuras se generan solas; no tienes que capturar cada mes a mano.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="plan-name">
              Nombre de la compra
            </label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Laptop"
              aria-label="Nombre de la compra"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="plan-amount">
                Monto por cuota
              </label>
              <CurrencyInput
                id="plan-amount"
                value={installmentAmount}
                onChange={setInstallmentAmount}
                aria-label="Monto de cada cuota"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="plan-total">
                Total de meses
              </label>
              <Input
                id="plan-total"
                type="number"
                min={2}
                max={60}
                inputMode="numeric"
                value={totalInstallments}
                onChange={(e) => setTotalInstallments(e.target.value)}
                aria-label="Total de meses del plan"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="plan-paid">
                Cuotas ya pagadas
              </label>
              <Input
                id="plan-paid"
                type="number"
                min={0}
                inputMode="numeric"
                value={paidInstallments}
                onChange={(e) => setPaidInstallments(e.target.value)}
                aria-label="Cuotas ya pagadas al dar de alta"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="plan-next-due">
                Próxima cuota (fecha)
              </label>
              <Input
                id="plan-next-due"
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                aria-label="Fecha de la próxima cuota"
              />
            </div>
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
                  ? ` · ${formatCurrency(installmentAmount)}/mes`
                  : ''}
              </p>
            </div>
          ) : null}

          <ToggleField
            label="Ya está en el saldo de la tarjeta"
            helper="Actívalo si registras la compra tarde y el estado de cuenta ya incluye el monto. No volverá a subir la deuda."
            checked={alreadyInBalance}
            onCheckedChange={setAlreadyInBalance}
            layout="stack"
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitting ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
