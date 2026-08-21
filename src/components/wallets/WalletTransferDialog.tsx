'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
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
import { isGoalWalletType, isTransferableWalletType } from '@/domain/payment-method';
import { cn, formatCurrency } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
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

const rowTriggerClass =
  'h-11 w-full max-w-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent';

const rowInputClass =
  'h-11 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0';

const groupedLabelClass =
  'w-[5rem] shrink-0 text-sm font-medium leading-none text-foreground';

function GroupedRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1 px-3 py-1.5">
      <div className="flex min-h-11 items-center gap-3">
        <span className={groupedLabelClass}>{label}</span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

const DIALOG_DESCRIPTION =
  'Mueve saldo entre efectivo y débito del mismo contexto. No crea ingresos ni gastos en el panel.';

const WalletTransferDialog = ({
  open,
  onOpenChange,
  wallets,
  defaultFromWalletId = null,
  context,
  onSuccess,
}: WalletTransferDialogProps) => {
  const isMobile = useIsMobile();
  const nestedSelectOpenRef = useRef(false);
  const blockDismissUntilRef = useRef(0);

  const fundingWallets = useMemo(
    () =>
      wallets.filter((w) => w.active && isTransferableWalletType(w.type)),
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

  const handleSelectOpenChange = (nextOpen: boolean) => {
    nestedSelectOpenRef.current = nextOpen;
    if (!nextOpen) {
      // Swallow the same touch that dismissed the list (iOS ghost click).
      blockDismissUntilRef.current = Date.now() + 500;
    }
  };

  const shouldBlockDismiss = () =>
    nestedSelectOpenRef.current || Date.now() < blockDismissUntilRef.current;

  const handleRootOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && shouldBlockDismiss()) return;
    if (!nextOpen && submitting) return;
    onOpenChange(nextOpen);
  };

  const preventDismissWhileSelectOpen = (event: {
    preventDefault: () => void;
  }) => {
    if (shouldBlockDismiss()) event.preventDefault();
  };

  const handleCancel = () => handleRootOpenChange(false);

  const fromWallet = fundingWallets.find((w) => String(w.id) === fromWalletId);
  const toOptions = fundingWallets.filter((w) => String(w.id) !== fromWalletId);
  const fromLocked = defaultFromWalletId != null;

  const parsedAmount = Number(amount.replace(/[,\s]/g, '')) || 0;
  const parsedFee =
    addFee ? Number(feeAmount.replace(/[,\s]/g, '')) || 0 : 0;
  const sourceDebit = parsedAmount + parsedFee;
  const wouldGoNegative =
    fromWallet != null && fromWallet.amount < sourceDebit && sourceDebit > 0;
  const fromIsGoal = fromWallet != null && isGoalWalletType(fromWallet.type);
  const goalExceedsSaved = fromIsGoal && wouldGoNegative;

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
    if (goalExceedsSaved && fromWallet) {
      toast.error(
        `En una meta no puedes transferir más de lo ahorrado (${formatCurrency(fromWallet.amount)})`,
      );
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
    if (goalExceedsSaved && fromWallet) {
      toast.error(
        `En una meta no puedes transferir más de lo ahorrado (${formatCurrency(fromWallet.amount)})`,
      );
      return;
    }
    if (wouldGoNegative) {
      setConfirmNegativeOpen(true);
      return;
    }
    void submitTransfer();
  };

  const canTransfer = fundingWallets.length >= 2;

  const cancelButton = (
    <Button
      type="button"
      variant="ghost"
      className="absolute left-0 h-9 px-2 text-primary"
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
        Transferir saldo
      </DialogTitle>
      <DialogDescription className="sr-only">
        {DIALOG_DESCRIPTION}
      </DialogDescription>
    </div>
  );

  const sheetHeader = (
    <div className="relative flex min-h-10 items-center justify-center">
      {cancelButton}
      <SheetTitle className="text-base font-semibold">
        Transferir saldo
      </SheetTitle>
      <SheetDescription className="sr-only">
        {DIALOG_DESCRIPTION}
      </SheetDescription>
    </div>
  );

  const formBody = (
    <div className={cn('flex flex-col gap-3', isMobile && 'pb-1')}>
      {!canTransfer ? (
        <p className="text-sm text-muted-foreground">
          Necesitas al menos dos billeteras de efectivo o débito activas para
          transferir.
        </p>
      ) : (
        <>
          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="space-y-1 px-3 py-2">
              <span className="text-sm font-medium text-foreground">Monto</span>
              <div className="flex items-center gap-2">
                <span
                  className="mr-[2.5rem] inline-flex h-7 shrink-0 items-center rounded-md bg-muted px-2 text-xs font-semibold tracking-wide text-muted-foreground"
                  aria-hidden
                >
                  MXN
                </span>
                <CurrencyInput
                  id="wallet-transfer-amount"
                  hideSymbol
                  clearable
                  value={parsedAmount}
                  onChange={(val) => setAmount(val === 0 ? '' : String(val))}
                  disabled={submitting}
                  placeholder="0.00"
                  className="h-10 border-0 bg-transparent px-0 font-mono text-2xl font-bold tabular-nums shadow-none focus-visible:ring-0 md:h-12 md:text-4xl"
                  enterKeyHint="next"
                  aria-label="Monto a transferir"
                />
              </div>
              {fromIsGoal && fromWallet ? (
                <p className="text-xs text-muted-foreground">
                  Máximo ahorrado:{' '}
                  <span className="font-mono tabular-nums text-foreground">
                    {formatCurrency(fromWallet.amount)}
                  </span>
                </p>
              ) : null}
              {goalExceedsSaved ? (
                <p className="text-xs text-destructive" role="alert">
                  El monto no puede ser mayor al ahorro de la meta.
                </p>
              ) : null}
            </div>

            <GroupedRow label="Desde">
              {fromLocked && fromWallet ? (
                <Input
                  value={`${fromWallet.name} · ${formatCurrency(fromWallet.amount)}`}
                  disabled
                  readOnly
                  aria-label="Billetera origen"
                  className={cn(
                    rowInputClass,
                    'disabled:cursor-default disabled:opacity-100',
                  )}
                />
              ) : (
                <Select
                  value={fromWalletId}
                  onOpenChange={handleSelectOpenChange}
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
                  <SelectTrigger
                    aria-label="Billetera origen"
                    className={rowTriggerClass}
                  >
                    <SelectValue placeholder="Selecciona" />
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
            </GroupedRow>

            <GroupedRow label="Hacia">
              <Select
                value={toWalletId}
                onOpenChange={handleSelectOpenChange}
                onValueChange={setToWalletId}
                disabled={submitting}
              >
                <SelectTrigger
                  aria-label="Billetera destino"
                  className={rowTriggerClass}
                >
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {toOptions.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name} · {formatCurrency(w.amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </GroupedRow>

            <GroupedRow label="Nota">
              <Input
                id="wallet-transfer-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opcional"
                disabled={submitting}
                className={rowInputClass}
                autoCapitalize="sentences"
                enterKeyHint="next"
              />
            </GroupedRow>

            <GroupedRow label="Fecha">
              <Input
                id="wallet-transfer-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={submitting}
                className={rowInputClass}
              />
            </GroupedRow>
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
            className="px-3"
          />

          {addFee ? (
            <div className="space-y-2">
              <p className="px-1 text-xs font-medium text-muted-foreground">
                Comisión
              </p>
              <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
                <div className="space-y-1 px-3 py-2">
                  <span className="text-sm font-medium text-foreground">
                    Monto
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className="mr-[2.5rem] inline-flex h-7 shrink-0 items-center rounded-md bg-muted px-2 text-xs font-semibold tracking-wide text-muted-foreground"
                      aria-hidden
                    >
                      MXN
                    </span>
                    <CurrencyInput
                      id="wallet-transfer-fee"
                      hideSymbol
                      clearable
                      value={parsedFee}
                      onChange={(val) =>
                        setFeeAmount(val === 0 ? '' : String(val))
                      }
                      disabled={submitting}
                      placeholder="0.00"
                      className="h-10 border-0 bg-transparent px-0 font-mono text-2xl font-bold tabular-nums shadow-none focus-visible:ring-0 md:h-12 md:text-4xl"
                      enterKeyHint="done"
                      aria-label="Comisión de transferencia"
                    />
                  </div>
                </div>
              </div>
              {parsedAmount > 0 ? (
                <p className="px-1 text-xs text-muted-foreground">
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
        </>
      )}

      <Button
        type="button"
        onClick={handleSubmitClick}
        disabled={submitting || !canTransfer}
        className="h-11 w-full rounded-xl"
      >
        {submitting ? 'Transferiendo…' : 'Transferir'}
      </Button>
    </div>
  );

  const overlay = isMobile ? (
    <Sheet open={open} onOpenChange={handleRootOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex max-h-[92vh] flex-col gap-0 rounded-t-xl p-0"
        onPointerDownOutside={preventDismissWhileSelectOpen}
        onFocusOutside={preventDismissWhileSelectOpen}
        onInteractOutside={preventDismissWhileSelectOpen}
      >
        <div className="border-b border-border/50 px-4 py-3">{sheetHeader}</div>
        <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {open ? formBody : null}
        </div>
      </SheetContent>
    </Sheet>
  ) : (
    <Dialog open={open} onOpenChange={handleRootOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md w-full gap-4 p-5"
        onPointerDownOutside={preventDismissWhileSelectOpen}
        onFocusOutside={preventDismissWhileSelectOpen}
        onInteractOutside={preventDismissWhileSelectOpen}
      >
        {dialogHeader}
        {open ? formBody : null}
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {overlay}

      <AlertDialog
        open={confirmNegativeOpen}
        onOpenChange={setConfirmNegativeOpen}
      >
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
