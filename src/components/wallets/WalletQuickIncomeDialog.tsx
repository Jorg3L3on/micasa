'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import {
  AmountRow,
  DateStepper,
  GroupedRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OVERLAY_PRIMARY_BUTTON_CLASS,
  OVERLAY_ROW_INPUT_CLASS,
  OverlayHint,
} from '@/components/overlay/overlay-form';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import type { FinanceContextType } from '@/types/finance-context';

export type WalletQuickIncomeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletId: number;
  walletName: string;
  context: FinanceContextType;
  onSuccess: () => Promise<void> | void;
};

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
    <div className="flex flex-col gap-3">
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
            className={OVERLAY_ROW_INPUT_CLASS}
          />
        </GroupedRow>
        <AmountRow
          id="wallet-income-amount"
          value={amount}
          onChange={setAmount}
          disabled={submitting}
        />
        <GroupedRow label="Fecha">
          <DateStepper value={date} onChange={setDate} disabled={submitting} />
        </GroupedRow>
      </div>

      <OverlayHint>
        Se asigna a la quincena de esa fecha y aumenta el saldo de {walletName}.
      </OverlayHint>

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
