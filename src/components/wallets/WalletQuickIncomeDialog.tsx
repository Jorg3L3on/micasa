'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  OVERLAY_AMOUNT_INPUT_CLASS,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_GROUPED_LABEL_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
} from '@/components/overlay/overlay-form';
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
        <Label htmlFor={htmlFor} className={OVERLAY_GROUPED_LABEL_CLASS}>
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

  const formBody = (
    <div className={cn('flex flex-col gap-4', isMobile && 'pb-1')}>
      <div className={OVERLAY_GROUPED_CARD_CLASS}>
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
              className={OVERLAY_AMOUNT_INPUT_CLASS}
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
        className={OVERLAY_PRIMARY_BUTTON_CLASS}
      >
        {submitting ? 'Guardando…' : 'Guardar'}
      </Button>
    </div>
  );

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar ingreso"
      description={description}
      busy={submitting}
    >
      {open ? formBody : null}
    </ResponsiveOverlay>
  );
};

export default WalletQuickIncomeDialog;
