'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import { AddExpenseFormValues } from '@/schemas/transaction.schema';

type AddExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AddExpenseFormValues) => Promise<void>;
  fortnightLabel: string;
  fortnightId: number;
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
  defaultDate?: string;
  error?: string | null;
};

function getDefaultDateForFortnight(
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

export default function AddExpenseDialog({
  open,
  onOpenChange,
  onSubmit,
  fortnightLabel,
  year,
  month,
  period,
  defaultDate,
  error,
}: AddExpenseDialogProps) {
  const resolvedDefaultDate =
    defaultDate || getDefaultDateForFortnight(year, month, period);

  const handleSubmit = async (data: AddExpenseFormValues) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar gasto — {fortnightLabel}</DialogTitle>
          <DialogDescription>
            Crea un nuevo gasto para esta quincena.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ExpenseForm
            key={`${year}-${month}-${period}-${resolvedDefaultDate}`}
            mode="create"
            defaults={{ date: resolvedDefaultDate }}
            fortnightPeriod={period}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            error={error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
