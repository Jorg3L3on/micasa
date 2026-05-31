'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  formatCalendarDate,
  parseCalendarDate,
  todayCalendarDate,
} from '@/lib/calendar-dates';
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
  const todayYmd = todayCalendarDate();
  const [currentYear, currentMonth, currentDay] = todayYmd.split('-').map(Number);

  if (year === currentYear && month === currentMonth) {
    if (period === 'FIRST' && currentDay >= 1 && currentDay <= 15) {
      return todayYmd;
    }
    if (period === 'SECOND' && currentDay >= 16) {
      return todayYmd;
    }
  }

  const day = period === 'FIRST' ? 1 : 16;
  return formatCalendarDate(
    parseCalendarDate(
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    ),
  );
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
