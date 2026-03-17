import Link from 'next/link';
import { CreditCard, Store, AlertTriangle } from 'lucide-react';
import type { DuePaymentItem } from '@/types/catalog';
import { formatCurrency, cn } from '@/lib/utils';

type DuePaymentsBannerProps = {
  duePayments: DuePaymentItem[];
};

const WALLET_TYPE_ICON: Record<string, typeof CreditCard> = {
  CREDIT_CARD: CreditCard,
  DEPARTMENT_STORE_CARD: Store,
};

const DuePaymentsBanner = ({ duePayments }: DuePaymentsBannerProps) => {
  if (duePayments.length === 0) return null;

  const today = new Date();
  const currentDay = today.getDate();

  return (
    <div
      className="rounded-lg border border-l-[3px] border-l-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10 px-3 py-2.5"
      role="region"
      aria-label="Pagos de tarjetas pendientes esta quincena"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/10 dark:bg-amber-500/15 shrink-0">
          <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pagos de tarjetas esta quincena
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {duePayments.map((payment) => {
          const Icon = WALLET_TYPE_ICON[payment.walletType] ?? CreditCard;
          const daysUntilDue = payment.dueDay - currentDay;
          const isOverdue = daysUntilDue < 0;
          const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 3;

          return (
            <Link
              key={payment.walletId}
              href={`/credit-cards/${payment.walletId}`}
              className={cn(
                'group flex items-center gap-2.5 rounded-md border px-3 py-2',
                'transition-shadow duration-200 hover:shadow-md',
                'bg-card dark:bg-card/80',
                isOverdue
                  ? 'border-destructive/40'
                  : isDueSoon
                    ? 'border-amber-500/40'
                    : 'border-border/60',
              )}
              aria-label={`Pagar ${payment.walletName}: ${formatCurrency(payment.nextDuePayment)} — vence día ${payment.dueDay}`}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-md shrink-0',
                  isOverdue
                    ? 'bg-destructive/10'
                    : 'bg-amber-500/10 dark:bg-amber-500/15',
                )}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5',
                    isOverdue
                      ? 'text-destructive'
                      : 'text-amber-600 dark:text-amber-400',
                  )}
                />
              </span>

              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate max-w-[120px] leading-none mb-0.5">
                  {payment.walletName}
                </p>
                <p className="text-sm font-bold font-mono tabular-nums leading-none">
                  {formatCurrency(payment.nextDuePayment)}
                </p>
              </div>

              <div className="ml-auto pl-2 text-right shrink-0">
                <p
                  className={cn(
                    'text-[9px] font-semibold leading-tight',
                    isOverdue
                      ? 'text-destructive'
                      : isDueSoon
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-muted-foreground',
                  )}
                >
                  {isOverdue
                    ? 'Vencido'
                    : daysUntilDue === 0
                      ? 'Vence hoy'
                      : `Día ${payment.dueDay}`}
                </p>
                <p className="text-[9px] text-muted-foreground leading-tight group-hover:text-foreground transition-colors">
                  Pagar →
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default DuePaymentsBanner;
