'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { WalletListItem } from '@/types/catalog';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import { formatCurrency } from '@/lib/utils';
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
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';

const BALANCE_INPUT_ID = 'wallet-balance-edit-dialog-input';

export type WalletBalanceEditDialogProps = {
  wallet: WalletListItem | null;
  ownerQueryString?: string;
  onOpenChange: (open: boolean) => void;
  onSaved?: (walletId: number, newAmount: number) => void;
};

const isCreditType = (type: string) =>
  type === 'CREDIT_CARD' || type === 'DEPARTMENT_STORE_CARD';

export const WalletBalanceEditDialog = ({
  wallet,
  ownerQueryString = '',
  onOpenChange,
  onSaved,
}: WalletBalanceEditDialogProps) => {
  const { context } = useFinanceContext();
  const [balanceInput, setBalanceInput] = useState('');
  const [savingBalance, setSavingBalance] = useState(false);

  useEffect(() => {
    if (!wallet) {
      setBalanceInput('');
      return;
    }
    setBalanceInput(String(wallet.amount));
  }, [wallet?.id, wallet?.amount, wallet]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (open) return;
      onOpenChange(false);
    },
    [onOpenChange],
  );

  const handleSaveBalance = useCallback(async () => {
    if (!wallet) return;
    if (!context) {
      toast.error('No hay contexto activo para guardar');
      return;
    }

    const parsed = Number(balanceInput.replace(/[,\s]/g, ''));
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error('Ingresa un saldo válido (no negativo)');
      return;
    }

    try {
      setSavingBalance(true);
      await clientFetchFromApi(
        `/api/wallets?id=${wallet.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ amount: parsed }),
        },
        context,
      );
      onSaved?.(wallet.id, parsed);
      toast.success('Saldo actualizado');
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo actualizar el saldo',
      );
      onOpenChange(false);
    } finally {
      setSavingBalance(false);
    }
  }, [balanceInput, context, onOpenChange, onSaved, wallet]);

  const isCredit = wallet ? isCreditType(wallet.type) : false;

  const detailHref = wallet
    ? isCredit
      ? `/credit-cards/${wallet.id}${ownerQueryString}`
      : `/wallets/${wallet.id}${ownerQueryString}`
    : '#';

  const detailLabel = isCredit ? 'Ir a página de tarjeta' : 'Ir a página de billetera';

  return (
    <Dialog open={Boolean(wallet)} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {wallet ? (
          <>
            <DialogHeader>
              <div className="flex items-start gap-3">
                <WalletProviderIcon
                  providerIconKey={wallet.provider_icon_key}
                  className="h-9 w-9 shrink-0 rounded-lg border border-border/60 shadow-sm"
                  iconClassName="h-5 w-5"
                  showTooltipLabel={false}
                />
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="truncate text-left text-base">
                    {wallet.name}
                  </DialogTitle>
                  <DialogDescription className="text-left text-xs">
                    Ajusta el saldo actual y revisa datos clave.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Saldo actual
                  </p>
                  <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                    {formatCurrency(wallet.amount)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {isCredit ? 'Límite' : 'Tipo'}
                  </p>
                  <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                    {isCredit
                      ? wallet.credit_limit != null
                        ? formatCurrency(wallet.credit_limit)
                        : '—'
                      : wallet.type === 'CASH'
                        ? 'Efectivo'
                        : 'Débito'}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {isCredit ? 'Disponible' : 'Corte'}
                  </p>
                  <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                    {isCredit
                      ? wallet.credit_limit != null
                        ? formatCurrency(
                            Math.max(
                              0,
                              Number(wallet.credit_limit) - Number(wallet.amount),
                            ),
                          )
                        : '—'
                      : wallet.cutoff_day != null
                        ? `Día ${wallet.cutoff_day}`
                        : '—'}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {isCredit ? 'Fecha pago' : 'Estado'}
                  </p>
                  <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                    {isCredit
                      ? wallet.due_day != null
                        ? `Día ${wallet.due_day}`
                        : '—'
                      : wallet.active
                        ? 'Activa'
                        : 'Inactiva'}
                  </p>
                </div>
                {wallet.assignee ? (
                  <div className="col-span-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Asignada a
                    </p>
                    <p className="truncate text-sm font-medium text-foreground">
                      {wallet.assignee.name}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor={BALANCE_INPUT_ID} className="text-xs">
                  Saldo actual
                </Label>
                <Input
                  id={BALANCE_INPUT_ID}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={balanceInput}
                  onChange={(event) => setBalanceInput(event.target.value)}
                  disabled={savingBalance}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" asChild>
                <Link href={detailHref}>{detailLabel}</Link>
              </Button>
              <Button
                type="button"
                onClick={handleSaveBalance}
                disabled={savingBalance}
                className="rounded-xl"
              >
                {savingBalance ? 'Guardando…' : 'Guardar saldo'}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
