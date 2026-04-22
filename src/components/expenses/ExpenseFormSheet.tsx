'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import ExpenseForm from '@/components/expenses/ExpenseForm';
import { AddExpenseFormValues } from '@/schemas/transaction.schema';

type ExpenseFormSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  title: string;
  description?: string;
  defaults?: Partial<AddExpenseFormValues>;
  onSubmit: (values: AddExpenseFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  error?: string | null;
};

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isMobile;
}

export default function ExpenseFormSheet({
  open,
  onOpenChange,
  mode,
  title,
  description,
  defaults,
  onSubmit,
  onDelete,
  error,
}: ExpenseFormSheetProps) {
  const isMobile = useIsMobile();

  const formBody = open ? (
    <ExpenseForm
      mode={mode}
      defaults={defaults}
      onSubmit={async (values) => {
        await onSubmit(values);
      }}
      onCancel={() => onOpenChange(false)}
      onDelete={
        onDelete
          ? async () => {
              await onDelete();
            }
          : undefined
      }
      error={error}
    />
  ) : null;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="flex max-h-[92vh] flex-col gap-0 rounded-t-xl p-0"
        >
          <SheetHeader className="border-b border-border/50 p-4 pb-3">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 pb-[env(safe-area-inset-bottom)]">
            {formBody}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {formBody}
      </DialogContent>
    </Dialog>
  );
}
