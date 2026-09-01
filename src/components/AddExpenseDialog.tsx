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
import { getDefaultDateForFortnight } from '@/lib/fortnight-calendar';

type AddExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: AddExpenseFormValues) => Promise<void>;
  fortnightLabel: string;
  fortnightId: number;
  year: number;
  month: number;
  period: 'FIRST' | 'SECOND';
  defaultDate?: string;
  error?: string | null;
};

export default function AddExpenseDialog({
  open,
  onOpenChange,
  onCreate,
  fortnightLabel,
  year,
  month,
  period,
  defaultDate,
  error,
}: AddExpenseDialogProps) {
  const resolvedDefaultDate =
    defaultDate || getDefaultDateForFortnight(year, month, period);

  const handleSave = async (data: AddExpenseFormValues) => {
    await onCreate(data);
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
            onSave={handleSave}
            onCancel={() => onOpenChange(false)}
            error={error}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
