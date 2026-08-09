'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { WalletListItem } from '@/types/catalog';
import { useFinanceContext } from '@/context/finance-context';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  type PaymentMethodType,
  PAYMENT_METHOD_LABELS,
} from '@/domain/payment-method';
import { cn, formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CurrencyInput } from '@/components/ui/currency-input';
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

type MetaRow = {
  label: string;
  value: string;
  mono?: boolean;
};

export const WalletBalanceEditDialog = ({
  wallet,
  ownerQueryString = '',
  onOpenChange,
  onSaved,
}: WalletBalanceEditDialogProps) => {
  const { context } = useFinanceContext();
  const [balanceInput, setBalanceInput] = useState(0);
  const [savingBalance, setSavingBalance] = useState(false);

  useEffect(() => {
    if (!wallet) {
      setBalanceInput(0);
      return;
    }
    setBalanceInput(Number(wallet.amount) || 0);
  }, [wallet?.id, wallet?.amount, wallet]);

  const handleClose = useCallback(
    (open: boolean) => {
      if (open) return;
      if (savingBalance) return;
      onOpenChange(false);
    },
    [onOpenChange, savingBalance],
  );

  const handleSaveBalance = useCallback(async () => {
    if (!wallet) return;
    if (!context) {
      toast.error('No hay contexto activo para guardar');
      return;
    }

    if (!Number.isFinite(balanceInput) || balanceInput < 0) {
      toast.error('Ingresa un saldo válido (no negativo)');
      return;
    }

    try {
      setSavingBalance(true);
      await clientFetchFromApi(
        `/api/wallets?id=${wallet.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ amount: balanceInput }),
        },
        context,
      );
      onSaved?.(wallet.id, balanceInput);
      toast.success('Saldo actualizado');
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo actualizar el saldo',
      );
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

  const metaRows = useMemo((): MetaRow[] => {
    if (!wallet) return [];

    if (isCredit) {
      const rows: MetaRow[] = [
        {
          label: 'Límite',
          value:
            wallet.credit_limit != null
              ? formatCurrency(wallet.credit_limit)
              : '—',
          mono: true,
        },
        {
          label: 'Disponible',
          value:
            wallet.credit_limit != null
              ? formatCurrency(
                  Math.max(
                    0,
                    Number(wallet.credit_limit) - Number(wallet.amount),
                  ),
                )
              : '—',
          mono: true,
        },
      ];
      if (wallet.due_day != null) {
        rows.push({ label: 'Fecha pago', value: `Día ${wallet.due_day}` });
      }
      if (wallet.assignee) {
        rows.push({ label: 'Asignada a', value: wallet.assignee.name });
      }
      return rows;
    }

    const rows: MetaRow[] = [
      {
        label: 'Tipo',
        value:
          PAYMENT_METHOD_LABELS[wallet.type as PaymentMethodType] ??
          wallet.type,
      },
      {
        label: 'Estado',
        value: wallet.active ? 'Activa' : 'Inactiva',
      },
    ];
    if (wallet.cutoff_day != null) {
      rows.push({ label: 'Corte', value: `Día ${wallet.cutoff_day}` });
    }
    if (wallet.assignee) {
      rows.push({ label: 'Asignada a', value: wallet.assignee.name });
    }
    return rows;
  }, [wallet, isCredit]);

  return (
    <Dialog open={Boolean(wallet)} onOpenChange={handleClose}>
      <DialogContent className="gap-5 border-border/60 p-5 shadow-md sm:max-w-md sm:p-6">
        {wallet ? (
          <>
            <DialogHeader className="space-y-3 text-left">
              <div className="flex items-start gap-3 pr-6">
                <WalletProviderIcon
                  providerIconKey={wallet.provider_icon_key}
                  className="h-10 w-10 shrink-0 rounded-xl border border-border/60 bg-card"
                  iconClassName="h-5 w-5"
                  showTooltipLabel={false}
                />
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="truncate text-left text-base font-semibold leading-tight tracking-tight sm:text-lg">
                    {wallet.name}
                  </DialogTitle>
                  <DialogDescription className="text-left text-sm text-muted-foreground">
                    Ajusta el saldo registrado en esta billetera.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Label htmlFor={BALANCE_INPUT_ID} className="text-sm">
                    Nuevo saldo
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ahora{' '}
                    <span className="font-mono tabular-nums text-foreground/80">
                      {formatCurrency(wallet.amount)}
                    </span>
                  </p>
                </div>
                <CurrencyInput
                  id={BALANCE_INPUT_ID}
                  value={balanceInput}
                  onChange={setBalanceInput}
                  placeholder="0.00"
                  disabled={savingBalance}
                  aria-label="Nuevo saldo"
                  className="h-11 text-base"
                />
              </div>

              {metaRows.length > 0 ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border/60 pt-3">
                  {metaRows.map((row) => (
                    <div key={row.label} className="min-w-0 space-y-0.5">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {row.label}
                      </dt>
                      <dd
                        className={cn(
                          'truncate text-sm text-foreground',
                          row.mono && 'font-mono font-semibold tabular-nums',
                        )}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>

            <DialogFooter className="gap-2 border-t border-border/60 pt-4 sm:justify-between">
              <Button
                variant="ghost"
                className="h-9 px-2 text-muted-foreground"
                asChild
              >
                <Link href={detailHref}>{detailLabel}</Link>
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveBalance()}
                disabled={savingBalance}
                className="h-9 min-w-[8.5rem] rounded-xl"
              >
                {savingBalance ? (
                  <>
                    <Loader2
                      className="h-4 w-4 animate-spin motion-reduce:animate-none"
                      aria-hidden
                      data-icon="inline-start"
                    />
                    Guardando…
                  </>
                ) : (
                  'Guardar saldo'
                )}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
