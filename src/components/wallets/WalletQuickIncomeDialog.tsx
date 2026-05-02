'use client';

import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
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

const getToday = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const WalletQuickIncomeDialog = ({
  open,
  onOpenChange,
  walletId,
  walletName,
  context,
  onSuccess,
}: WalletQuickIncomeDialogProps) => {
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getToday());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSource('');
      setAmount('');
      setDate(getToday());
    }
  }, [open]);

  const handleSubmit = async () => {
    const parsed = Number(amount.replace(/[,\s]/g, ''));
    if (!source.trim()) {
      toast.error('Ingresa una descripción');
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
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
            amount: parsed,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
              <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="text-left text-base">
                Registrar ingreso
              </DialogTitle>
              <DialogDescription className="text-left text-xs leading-relaxed">
                Registra un ingreso a{' '}
                <span className="font-medium text-foreground">{walletName}</span>
                . Se asigna a la quincena según la fecha y aumenta el saldo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div className="space-y-2">
            <Label htmlFor="wallet-income-source" className="text-xs">
              Descripción
            </Label>
            <Input
              id="wallet-income-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Ej. Sueldo, reembolso, etc."
              disabled={submitting}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wallet-income-amount" className="text-xs">
              Monto
            </Label>
            <Input
              id="wallet-income-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wallet-income-date" className="text-xs">
              Fecha
            </Label>
            <Input
              id="wallet-income-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl"
          >
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WalletQuickIncomeDialog;
