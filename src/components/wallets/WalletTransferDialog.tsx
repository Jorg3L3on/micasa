'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleField } from '@/components/ui/toggle';
import { createWalletTransfer } from '@/lib/api/wallets';
import { todayCalendarDate } from '@/lib/calendar-dates';
import { formatCurrency } from '@/lib/utils';
import type { FinanceContextType } from '@/types/finance-context';

export type WalletTransferOption = {
  id: number;
  name: string;
  type: string;
  amount: number;
  active: boolean;
};

export type WalletTransferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: WalletTransferOption[];
  /** Pre-select source wallet when opened from a card/detail. */
  defaultFromWalletId?: number | null;
  context: FinanceContextType;
  onSuccess: () => Promise<void> | void;
};

const isFunding = (type: string) => type === 'CASH' || type === 'DEBIT_CARD';

const WalletTransferDialog = ({
  open,
  onOpenChange,
  wallets,
  defaultFromWalletId = null,
  context,
  onSuccess,
}: WalletTransferDialogProps) => {
  const fundingWallets = useMemo(
    () => wallets.filter((w) => w.active && isFunding(w.type)),
    [wallets],
  );

  const [amount, setAmount] = useState('');
  const [fromWalletId, setFromWalletId] = useState<string>('');
  const [toWalletId, setToWalletId] = useState<string>('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(todayCalendarDate());
  const [addFee, setAddFee] = useState(false);
  const [feeAmount, setFeeAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmNegativeOpen, setConfirmNegativeOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setNote('');
    setDate(todayCalendarDate());
    setAddFee(false);
    setFeeAmount('');
    setConfirmNegativeOpen(false);

    const preferredFrom =
      defaultFromWalletId != null &&
      fundingWallets.some((w) => w.id === defaultFromWalletId)
        ? defaultFromWalletId
        : fundingWallets[0]?.id;
    setFromWalletId(preferredFrom != null ? String(preferredFrom) : '');

    const toCandidate = fundingWallets.find((w) => w.id !== preferredFrom);
    setToWalletId(toCandidate != null ? String(toCandidate.id) : '');
  }, [open, defaultFromWalletId, fundingWallets]);

  const fromWallet = fundingWallets.find((w) => String(w.id) === fromWalletId);
  const toOptions = fundingWallets.filter((w) => String(w.id) !== fromWalletId);
  const fromLocked = defaultFromWalletId != null;

  const parsedAmount = Number(amount.replace(/[,\s]/g, '')) || 0;
  const parsedFee =
    addFee ? Number(feeAmount.replace(/[,\s]/g, '')) || 0 : 0;
  const sourceDebit = parsedAmount + parsedFee;
  const wouldGoNegative =
    fromWallet != null && fromWallet.amount < sourceDebit && sourceDebit > 0;

  const submitTransfer = async () => {
    if (!fromWalletId || !toWalletId) {
      toast.error('Selecciona billetera origen y destino');
      return;
    }
    if (fromWalletId === toWalletId) {
      toast.error('Origen y destino deben ser distintas');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }
    if (addFee && (!Number.isFinite(parsedFee) || parsedFee < 0)) {
      toast.error('Ingresa una comisión válida');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error('Fecha inválida');
      return;
    }

    try {
      setSubmitting(true);
      await createWalletTransfer(
        {
          from_wallet_id: Number(fromWalletId),
          to_wallet_id: Number(toWalletId),
          amount: parsedAmount,
          fee_amount: parsedFee,
          note: note.trim() || null,
          transferred_at: date,
          exclude_from_report: true,
        },
        context,
      );
      toast.success('Transferencia registrada');
      onOpenChange(false);
      await onSuccess();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'No se pudo transferir',
      );
    } finally {
      setSubmitting(false);
      setConfirmNegativeOpen(false);
    }
  };

  const handleSubmitClick = () => {
    if (wouldGoNegative) {
      setConfirmNegativeOpen(true);
      return;
    }
    void submitTransfer();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
                <ArrowLeftRight
                  className="h-4 w-4 text-blue-600 dark:text-blue-400"
                  data-icon="inline-start"
                />
              </span>
              <div className="min-w-0 space-y-1.5">
                <DialogTitle className="text-left text-base">
                  Transferir saldo
                </DialogTitle>
                <DialogDescription className="text-left text-xs leading-relaxed">
                  Mueve saldo entre efectivo y débito del mismo contexto. No
                  crea ingresos ni gastos en el panel.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {fundingWallets.length < 2 ? (
            <p className="text-xs text-muted-foreground">
              Necesitas al menos dos billeteras de efectivo o débito activas
              para transferir.
            </p>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="space-y-2">
                <Label htmlFor="wallet-transfer-amount" className="text-xs">
                  Monto
                </Label>
                <CurrencyInput
                  id="wallet-transfer-amount"
                  value={parsedAmount}
                  onChange={(val) => setAmount(val === 0 ? '' : String(val))}
                  disabled={submitting}
                  placeholder="0.00"
                  aria-label="Monto a transferir"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Desde</Label>
                {fromLocked && fromWallet ? (
                  <Input
                    value={`${fromWallet.name} · ${formatCurrency(fromWallet.amount)}`}
                    disabled
                    readOnly
                    aria-label="Billetera origen"
                    className="disabled:opacity-100"
                  />
                ) : (
                  <Select
                    value={fromWalletId}
                    onValueChange={(value) => {
                      setFromWalletId(value);
                      if (toWalletId === value) {
                        const next = fundingWallets.find(
                          (w) => String(w.id) !== value,
                        );
                        setToWalletId(next != null ? String(next.id) : '');
                      }
                    }}
                    disabled={submitting}
                  >
                    <SelectTrigger aria-label="Billetera origen" className="w-full">
                      <SelectValue placeholder="Selecciona origen" />
                    </SelectTrigger>
                    <SelectContent>
                      {fundingWallets.map((w) => (
                        <SelectItem key={w.id} value={String(w.id)}>
                          {w.name} · {formatCurrency(w.amount)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Hacia</Label>
                <Select
                  value={toWalletId}
                  onValueChange={setToWalletId}
                  disabled={submitting}
                >
                  <SelectTrigger aria-label="Billetera destino" className="w-full">
                    <SelectValue placeholder="Selecciona destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {toOptions.map((w) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        {w.name} · {formatCurrency(w.amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wallet-transfer-note" className="text-xs">
                  Nota
                </Label>
                <Input
                  id="wallet-transfer-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Opcional"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wallet-transfer-date" className="text-xs">
                  Fecha
                </Label>
                <Input
                  id="wallet-transfer-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <ToggleField
                label="Agregar comisión"
                checked={addFee}
                onCheckedChange={(checked) => {
                  setAddFee(checked);
                  if (!checked) setFeeAmount('');
                }}
                disabled={submitting}
                layout="row"
              />

              {addFee ? (
                <div className="space-y-2 pl-1">
                  <Label htmlFor="wallet-transfer-fee" className="text-xs">
                    Comisión
                  </Label>
                  <CurrencyInput
                    id="wallet-transfer-fee"
                    value={parsedFee}
                    onChange={(val) =>
                      setFeeAmount(val === 0 ? '' : String(val))
                    }
                    disabled={submitting}
                    placeholder="0.00"
                    aria-label="Comisión de transferencia"
                  />
                  {parsedAmount > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Origen descuenta{' '}
                      <span className="font-mono tabular-nums text-foreground">
                        {formatCurrency(sourceDebit)}
                      </span>
                      ; destino recibe{' '}
                      <span className="font-mono tabular-nums text-foreground">
                        {formatCurrency(parsedAmount)}
                      </span>
                      .
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

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
              onClick={handleSubmitClick}
              disabled={submitting || fundingWallets.length < 2}
              className="rounded-xl"
            >
              {submitting ? 'Transferiendo…' : 'Transferir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmNegativeOpen} onOpenChange={setConfirmNegativeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Saldo insuficiente</AlertDialogTitle>
            <AlertDialogDescription>
              {fromWallet
                ? `${fromWallet.name} tiene ${formatCurrency(fromWallet.amount)} y se descontarán ${formatCurrency(sourceDebit)}. El saldo quedará negativo. ¿Continuar?`
                : 'El saldo de origen quedará negativo. ¿Continuar?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault();
                void submitTransfer();
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default WalletTransferDialog;
