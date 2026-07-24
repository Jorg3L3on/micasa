'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import {
  cardPaymentPlanFormSchema,
  type CardPaymentPlanFormValues,
} from '@/schemas/credit-card-payment-plan.schema';

type EditCardPaymentPlanDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CardPaymentPlanFormValues) => Promise<void>;
  onClearPlan?: () => Promise<void>;
  walletName: string;
  fortnightLabel: string;
  suggestedAmount: number;
  outstandingBalance: number;
  initialPlannedAmount: number;
  hasCustomPlan: boolean;
  error?: string | null;
};

export const EditCardPaymentPlanDialog = ({
  open,
  onOpenChange,
  onSubmit,
  onClearPlan,
  walletName,
  fortnightLabel,
  suggestedAmount,
  outstandingBalance,
  initialPlannedAmount,
  hasCustomPlan,
  error,
}: EditCardPaymentPlanDialogProps) => {
  const form = useForm<CardPaymentPlanFormValues>({
    resolver: zodResolver(cardPaymentPlanFormSchema),
    defaultValues: {
      plannedAmount: initialPlannedAmount,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ plannedAmount: initialPlannedAmount });
    }
  }, [open, initialPlannedAmount, form]);

  const handleSubmit = async (data: CardPaymentPlanFormValues) => {
    try {
      await onSubmit(data);
    } catch {
      // Parent shows toast; close either way after the attempt.
    } finally {
      onOpenChange(false);
    }
  };

  const handleClear = async () => {
    if (!onClearPlan) return;
    try {
      await onClearPlan();
    } catch {
      // Parent shows toast; close either way after the attempt.
    } finally {
      onOpenChange(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pago planeado — {walletName}</DialogTitle>
          <DialogDescription>
            Cuánto planeas pagar en {fortnightLabel}. No cambia la deuda total de
            la tarjeta.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {error ? (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            <FormField
              control={form.control}
              name="plannedAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto a pagar esta quincena (MXN)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={outstandingBalance > 0 ? outstandingBalance : undefined}
                      placeholder="0.00"
                      {...field}
                      value={
                        typeof field.value === 'number' && !Number.isNaN(field.value)
                          ? field.value
                          : ''
                      }
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === '') {
                          field.onChange(NaN);
                          return;
                        }
                        const parsed = Number.parseFloat(next);
                        field.onChange(Number.isFinite(parsed) ? parsed : field.value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>Sugerido al corte: {formatCurrency(suggestedAmount)}</p>
                    <p>Deuda total: {formatCurrency(outstandingBalance)}</p>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              {hasCustomPlan && onClearPlan ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-muted-foreground"
                  disabled={form.formState.isSubmitting}
                  onClick={handleClear}
                >
                  Usar sugerido
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
