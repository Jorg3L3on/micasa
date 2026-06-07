'use client';

import { Banknote, Info, Scale } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { DashboardData } from '@/types/dashboard';
import { cn, formatCurrency } from '@/lib/utils';

type DashboardFundingNetCardProps = {
  amount: number;
  fundingWalletBalanceTotal: number;
  pendingAmount: number;
  payrollDeductionAmount?: number;
  wallets: DashboardData['fundingWalletBreakdown'];
  className?: string;
};

const WALLET_TYPE_LABELS = {
  CASH: 'Efectivo',
  DEBIT_CARD: 'Débito',
} as const;

export default function DashboardFundingNetCard({
  amount,
  fundingWalletBalanceTotal,
  pendingAmount,
  payrollDeductionAmount = 0,
  wallets,
  className,
}: DashboardFundingNetCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card p-4 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-sm font-medium text-muted-foreground">
            Efectivo neto en cuentas
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg border border-border/60 bg-muted/20"
                aria-label="Ver desglose de efectivo neto en cuentas"
              >
                <Info className="h-4 w-4" aria-hidden />
              </Button>
            </DialogTrigger>
            <DialogContent className="border-emerald-500/30 sm:max-w-2xl">
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
                    <Banknote className="h-4 w-4" aria-hidden />
                  </span>
                  <DialogTitle className="text-sm font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Desglose de billeteras vs pendiente
                  </DialogTitle>
                </div>
                <DialogDescription>
                  Efectivo y débito disponibles menos lo pendiente por pagar y las
                  deducciones de nómina del periodo actual.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-xl border border-emerald-500/25 bg-card p-4">
                {wallets.length > 0 ? (
                  <ul className="space-y-3">
                    {wallets.map((wallet) => (
                      <li
                        key={wallet.id}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <span className="truncate text-sm font-medium text-foreground sm:text-base">
                            {wallet.name}
                          </span>{' '}
                          <span className="text-xs text-muted-foreground">
                            ({WALLET_TYPE_LABELS[wallet.type]})
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground sm:text-base">
                          {formatCurrency(wallet.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-3 text-sm text-muted-foreground">
                    No hay billeteras activas de efectivo o débito.
                  </p>
                )}

                <div className="mt-4 space-y-2 border-t border-emerald-500/20 pt-4">
                  <BreakdownRow
                    label="Total billeteras (efectivo + débito)"
                    amount={fundingWalletBalanceTotal}
                  />
                  <BreakdownRow
                    label="Menos pendiente de la quincena (no pagado)"
                    amount={pendingAmount > 0 ? -pendingAmount : 0}
                    tone="pending"
                  />
                  {payrollDeductionAmount > 0 ? (
                    <BreakdownRow
                      label="Menos deducciones de nómina (préstamos)"
                      amount={-payrollDeductionAmount}
                      tone="pending"
                    />
                  ) : null}
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-emerald-500/30 pt-3">
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    = Efectivo neto en cuentas
                  </span>
                  <span
                    className={cn(
                      'shrink-0 font-mono text-base font-bold tabular-nums',
                      amount < 0
                        ? 'text-destructive'
                        : 'text-emerald-600 dark:text-emerald-400',
                    )}
                  >
                    {formatCurrency(amount)}
                  </span>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-400">
            <Scale className="h-4 w-4 text-white" aria-hidden />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <span
          className={cn(
            'font-mono text-2xl font-bold tracking-tight tabular-nums',
            amount < 0 ? 'text-destructive' : 'text-foreground',
          )}
        >
          {formatCurrency(amount)}
        </span>
        <span className="text-xs text-muted-foreground">
          Billeteras menos pendiente y deducciones de nómina
        </span>
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  amount,
  tone = 'default',
}: {
  label: string;
  amount: number;
  tone?: 'default' | 'pending';
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          'shrink-0 font-mono text-sm font-bold tabular-nums text-foreground sm:text-base',
          tone === 'pending' && 'text-amber-500 dark:text-amber-400',
        )}
      >
        {formatCurrency(amount)}
      </span>
    </div>
  );
}
