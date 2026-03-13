'use client';

import { useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
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
import { useFinanceContext } from '@/context/finance-context';
import { createIncome } from '@/lib/api';

const quickIncomeSchema = z.object({
  source: z.string().min(1, 'La descripción es requerida'),
  amount: z
    .number({
      required_error: 'El monto es requerido',
      invalid_type_error: 'El monto debe ser un número',
    })
    .positive('El monto debe ser mayor a 0'),
  date: z.string().min(1, 'La fecha es requerida'),
});

type QuickIncomeFormValues = z.infer<typeof quickIncomeSchema>;

type DashboardQuickIncomeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fortnight: {
    id: number;
    label: string;
    year: number;
    month: number;
    period: 'FIRST' | 'SECOND';
  };
  onCreated: () => void;
};

function getDefaultIncomeDate(
  year: number,
  month: number,
  period: 'FIRST' | 'SECOND',
): string {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  if (year === currentYear && month === currentMonth) {
    const day = today.getDate();
    if (period === 'FIRST' && day >= 1 && day <= 15) {
      return today.toISOString().split('T')[0];
    }
    if (period === 'SECOND' && day >= 16) {
      return today.toISOString().split('T')[0];
    }
  }

  const day = period === 'FIRST' ? 1 : 16;
  const date = new Date(year, month - 1, day);
  return date.toISOString().split('T')[0];
}

export default function DashboardQuickIncomeDialog({
  open,
  onOpenChange,
  fortnight,
  onCreated,
}: DashboardQuickIncomeDialogProps) {
  const { context } = useFinanceContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<QuickIncomeFormValues>({
    resolver: zodResolver(quickIncomeSchema),
    defaultValues: {
      source: '',
      amount: 0,
      date: getDefaultIncomeDate(
        fortnight.year,
        fortnight.month,
        fortnight.period,
      ),
    },
  });

  const handleSubmit = async (values: QuickIncomeFormValues) => {
    setIsSubmitting(true);
    try {
      await createIncome(
        {
          fortnight_id: fortnight.id,
          amount: values.amount,
          source: values.source,
          received_at: `${values.date}T00:00:00.000Z`,
        },
        context,
      );
      form.reset({
        source: '',
        amount: 0,
        date: getDefaultIncomeDate(
          fortnight.year,
          fortnight.month,
          fortnight.period,
        ),
      });
      onOpenChange(false);
      onCreated();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset({
        source: '',
        amount: 0,
        date: getDefaultIncomeDate(
          fortnight.year,
          fortnight.month,
          fortnight.period,
        ),
      });
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar ingreso — {fortnight.label}</DialogTitle>
          <DialogDescription>
            Registra un nuevo ingreso rápido para este periodo.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as any)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="source"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input placeholder="Descripción del ingreso" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      {...field}
                      value={field.value || ''}
                      onChange={(event) =>
                        field.onChange(
                          parseFloat(event.target.value) || 0,
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fecha</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

