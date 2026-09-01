'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { cn } from '@/lib/utils';
import type { FinanceContextType } from '@/types/finance-context';

export type WalletQuickIncomeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletId: number;
  walletName: string;
  context: FinanceContextType;
  onSuccess: () => Promise<void> | void;
};

const groupedLabelClass =
  'w-[5rem] shrink-0 text-sm font-medium leading-none text-foreground';

function GroupedRow({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1 px-3 py-1.5">
      <div className="flex min-h-11 items-center gap-3">
        <Label htmlFor={htmlFor} className={groupedLabelClass}>
          {label}
        </Label>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

const WalletQuickIncomeDialog = ({
  open,
  onOpenChange,
  walletId,
  walletName,
  context,
  onSuccess,
}: WalletQuickIncomeDialogProps) => {
  const isMobile = useIsMobile();
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayCalendarDate());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSource('');
      setAmount(0);
      setDate(todayCalendarDate());
    }
  }, [open]);

  const handleCancel = () => onOpenChange(false);

  const handleSubmit = async () => {
    if (!source.trim()) {
      toast.error('Ingresa una descripción');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error('Fecha inválida');
      return;
    }
    try {
      setSubmitting(true);
      await clientFetchFromApi(
        `/api/wallets/${walletId}/incomes`,
        {
          method: 'POST',
          body: JSON.stringify({
            date,
            amount,
            source: source.trim(),
          }),
        },
        context,
      );
      toast.success('Ingreso registrado');
      onOpenChange(false);
      await onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo registrar el ingreso',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const description = `Registra un ingreso a ${walletName}. Se asigna a la quincena según la fecha y aumenta el saldo.`;

  const cancelButton = (
    <Button
      type="button"
      variant="ghost"
      className="absolute left-0 h-9 px-2 text-primary-text"
      onClick={handleCancel}
      disabled={submitting}
    >
      Cancelar
    </Button>
  );

  const dialogHeader = (
    <div className="relative flex min-h-10 items-center justify-center">
      {cancelButton}
      <DialogTitle className="text-base font-semibold">
        Registrar ingreso
      </DialogTitle>
      <DialogDescription className="sr-only">{description}</DialogDescription>
    </div>
  );

  const sheetHeader = (
    <div className="relative flex min-h-10 items-center justify-center">
      {cancelButton}
      <SheetTitle className="text-base font-semibold">
        Registrar ingreso
      </SheetTitle>
      <SheetDescription className="sr-only">{description}</SheetDescription>
    </div>
  );

  const formBody = (
    <div className={cn('flex flex-col gap-4', isMobile && 'pb-1')}>
      <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
        <GroupedRow label="Descripción" htmlFor="wallet-income-source">
          <Input
            id="wallet-income-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Ej. Sueldo, reembolso…"
            disabled={submitting}
            autoFocus={!isMobile}
            autoCapitalize="sentences"
            autoComplete="off"
            enterKeyHint="next"
            className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </GroupedRow>

        <div className="space-y-1 px-3 py-2">
          <Label
            htmlFor="wallet-income-amount"
            className="text-sm font-medium text-foreground"
          >
            Monto
          </Label>
          <div className="flex items-center gap-2">
            <span
              className="mr-[2.5rem] inline-flex h-7 shrink-0 items-center rounded-md bg-muted px-2 text-xs font-semibold tracking-wide text-muted-foreground"
              aria-hidden
            >
              MXN
            </span>
            <CurrencyInput
              id="wallet-income-amount"
              hideSymbol
              clearable
              value={amount}
              onChange={setAmount}
              disabled={submitting}
              placeholder="0.00"
              aria-label="Monto"
              enterKeyHint="next"
              className="h-10 border-0 bg-transparent px-0 font-mono text-2xl font-bold tabular-nums shadow-none focus-visible:ring-0 md:h-12 md:text-4xl"
            />
          </div>
        </div>

        <GroupedRow label="Fecha" htmlFor="wallet-income-date">
          <Input
            id="wallet-income-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={submitting}
            className="h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </GroupedRow>
      </div>

      <Button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={submitting}
        className="h-11 w-full rounded-xl"
      >
        {submitting ? 'Guardando…' : 'Guardar'}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="flex max-h-[92vh] flex-col gap-0 rounded-t-xl p-0"
        >
          <div className="border-b border-border/50 px-4 py-3">{sheetHeader}</div>
          <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {open ? formBody : null}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-md gap-4 p-5"
      >
        {dialogHeader}
        {open ? formBody : null}
      </DialogContent>
    </Dialog>
  );
};

export default WalletQuickIncomeDialog;
