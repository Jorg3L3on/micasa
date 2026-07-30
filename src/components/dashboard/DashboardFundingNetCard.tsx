'use client';

import { Info } from 'lucide-react';
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
        'flex flex-col justify-between rounded-xl border border-border/60 bg-card p-6',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            Liquidez actual
          </span>
          <span className="text-xs text-muted-foreground">
            Billeteras menos pendiente y nómina
          </span>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Ver desglose de liquidez actual"
            >
              <Info className="h-4 w-4" aria-hidden />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Desglose de liquidez actual</DialogTitle>
              <DialogDescription>
                Efectivo y débito en cuentas, menos lo pendiente por pagar y
                las deducciones de nómina del periodo seleccionado.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {wallets.length > 0 ? (
                <ul className="space-y-2">
                  {wallets.map((wallet) => (
                    <li
                      key={wallet.id}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="min-w-0 truncate text-sm text-foreground">
                        {wallet.name}{' '}
                        <span className="text-xs text-muted-foreground">
                          ({WALLET_TYPE_LABELS[wallet.type]})
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-sm font-medium tabular-nums text-foreground">
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

              <div className="space-y-2 border-t border-border/60 pt-3">
                <BreakdownRow
                  label="Total billeteras"
                  amount={fundingWalletBalanceTotal}
                />
                <BreakdownRow
                  label="Menos pendiente (no pagado)"
                  amount={pendingAmount > 0 ? -pendingAmount : 0}
                  tone="pending"
                />
                {payrollDeductionAmount > 0 ? (
                  <BreakdownRow
                    label="Menos deducciones de nómina"
                    amount={-payrollDeductionAmount}
                    tone="pending"
                  />
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                <span className="text-sm font-medium text-foreground">
                  = Liquidez actual
                </span>
                <span
                  className={cn(
                    'shrink-0 font-mono text-base font-medium tabular-nums',
                    amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground',
                  )}
                >
                  {formatCurrency(amount)}
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4">
        <span
          className={cn(
            'font-mono text-2xl font-medium tracking-tight tabular-nums',
            amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground',
          )}
        >
          {formatCurrency(amount)}
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
