'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import { Banknote, CreditCard, Loader2, Store } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { DuePaymentItem } from '@/types/catalog';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

/** Mirrors ExpenseTable logic: dueDay − todayDay within the same month. */
const getDaysLeft = (dueDay: number, todayYmd: string): number => {
  const todayDay = parseInt(todayYmd.split('-')[2], 10);
  return dueDay - todayDay;
};

const daysLeftColor = (days: number, status: PlannerCardPaymentStatus) => {
  if (status === 'pagado') return 'text-muted-foreground';
  if (days < 0) return 'text-destructive';
  if (days <= 3) return 'text-destructive';
  if (days <= 7) return 'text-amber-600 dark:text-amber-400';
  return 'text-blue-600 dark:text-blue-400';
};

const WALLET_TYPE_ICON: Record<string, typeof CreditCard> = {
  CREDIT_CARD: CreditCard,
  DEPARTMENT_STORE_CARD: Store,
};

export type PlannerCardPaymentStatus = 'pagado' | 'vencido' | 'por_pagar';

/** Compares calendar dates as YYYY-MM-DD (UTC date string from API). */
export const getPlannerCardPaymentStatus = (
  item: DuePaymentItem,
  todayYmd: string,
): PlannerCardPaymentStatus => {
  if (item.nextDuePayment <= 0) return 'pagado';
  if (item.statementDueDate < todayYmd) return 'vencido';
  return 'por_pagar';
};

const statusLabel = (s: PlannerCardPaymentStatus) => {
  if (s === 'pagado') return 'Pagado';
  if (s === 'vencido') return 'Vencido';
  return 'Por pagar';
};

type FortnightCardPaymentsPanelProps = {
  items: DuePaymentItem[];
  ownerQueryString: string;
  fortnightLabel: string;
  /** Planning month year (e.g. 2026) — used to build the display due date. */
  plannerYear: number;
  /** Planning month 1–12 (e.g. 4 for April) — used to build the display due date. */
  plannerMonth: number;
  isCompact?: boolean;
  onPayCard?: (item: DuePaymentItem) => void;
  /** Mientras se cargan billeteras/categorías para el diálogo de pago */
  payingWalletId?: number | null;
};

const FortnightCardPaymentsPanel = ({
  items,
  ownerQueryString,
  fortnightLabel,
  plannerYear,
  plannerMonth,
  isCompact = false,
  onPayCard,
  payingWalletId = null,
}: FortnightCardPaymentsPanelProps) => {
  const todayYmd = useHydrationSafeTodayYmd();

  const rows = useMemo(
    () =>
      [...items].sort((a, b) => {
        const sa = getPlannerCardPaymentStatus(a, todayYmd);
        const sb = getPlannerCardPaymentStatus(b, todayYmd);
        const order = (s: PlannerCardPaymentStatus) =>
          s === 'vencido' ? 0 : s === 'por_pagar' ? 1 : 2;
        if (order(sa) !== order(sb)) return order(sa) - order(sb);
        return b.nextDuePayment - a.nextDuePayment;
      }),
    [items, todayYmd],
  );

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border/60 bg-card px-4 py-8 text-center',
          isCompact ? 'text-xs' : 'text-sm',
        )}
        role="region"
        aria-label={`Pagos de tarjeta: ${fortnightLabel}`}
      >
        <p className="text-muted-foreground">
          No hay tarjetas con fecha de pago en esta quincena.
        </p>
      </div>
    );
  }

  return (
    <Card
      className="overflow-hidden border-border/60"
      role="region"
      aria-label={`Pagos de tarjeta: ${fortnightLabel}`}
    >
      <CardContent className="px-0 pb-1 pt-0">
        <p className="px-3 pt-3 pb-2 text-[10px] text-muted-foreground leading-snug">
          Monto sugerido según movimientos en MiCasa. El banco puede indicar otro importe.
        </p>
        <div className="divide-y divide-border/40">
          {rows.map((item) => {
            const status = getPlannerCardPaymentStatus(item, todayYmd);
            const Icon = WALLET_TYPE_ICON[item.walletType] ?? CreditCard;
            const href = `/credit-cards/${item.walletId}${ownerQueryString}`;
            const daysLeft = getDaysLeft(item.dueDay, todayYmd);

            // Always display dueDay within the planning month (e.g. "8 abr 2026"),
            // rather than statementDueDate which can land in the following month.
            const mm = String(plannerMonth).padStart(2, '0');
            const dd = String(item.dueDay).padStart(2, '0');
            const displayDueDateStr = `${plannerYear}-${mm}-${dd}`;
            const displayDueDate = formatDate(displayDueDateStr);
            const dateColor = daysLeftColor(daysLeft, status);

            const daysLabel = (() => {
              if (status === 'pagado') return null;
              if (daysLeft < 0) return 'vencido';
              if (daysLeft === 0) return 'vence hoy';
              return `en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`;
            })();

            return (
              <div
                key={item.walletId}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 border-l-[3px]',
                  isCompact ? 'py-2' : 'py-3',
                  status === 'vencido' && 'border-l-destructive/50',
                  status === 'por_pagar' && 'border-l-amber-500/50',
                  status === 'pagado' && 'border-l-emerald-500/40',
                )}
              >
                {/* Icon */}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/10 dark:bg-violet-500/15">
                  <Icon className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                </span>

                {/* Name + status + date */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <Link
                      href={href}
                      className={cn(
                        'truncate font-medium hover:underline text-foreground',
                        isCompact ? 'text-xs' : 'text-sm',
                      )}
                    >
                      {item.walletName}
                    </Link>
                    <Badge
                      variant={
                        status === 'vencido'
                          ? 'destructive'
                          : status === 'pagado'
                            ? 'secondary'
                            : 'outline'
                      }
                      className={cn(
                        'shrink-0 text-[10px] px-1.5',
                        status === 'por_pagar' &&
                          'border-amber-500/50 text-amber-800 dark:text-amber-300',
                        status === 'pagado' &&
                          'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
                      )}
                    >
                      {statusLabel(status)}
                    </Badge>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn('text-xs font-medium tabular-nums', dateColor)}>
                      {displayDueDate}
                    </span>
                    {daysLabel && (
                      <span className={cn('text-[10px] tabular-nums', dateColor)}>
                        · {daysLabel}
                      </span>
                    )}
                    {item.cutoff_day != null && (
                      <span className="text-[10px] text-muted-foreground/60">
                        · Corte día {item.cutoff_day}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount + pay button */}
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      'font-mono tabular-nums font-semibold',
                      isCompact ? 'text-xs' : 'text-sm',
                      status === 'pagado' ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {formatCurrency(item.nextDuePayment)}
                  </span>
                  {onPayCard && status !== 'pagado' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            className={cn(
                              'border-border/60 bg-card shadow-none',
                              'transition-colors hover:border-emerald-500/45 hover:bg-emerald-500/6 dark:hover:bg-emerald-500/10',
                              'disabled:pointer-events-none disabled:opacity-45',
                              '[&_svg]:text-emerald-600 dark:[&_svg]:text-emerald-400',
                            )}
                            disabled={
                              item.outstandingBalance <= 0 ||
                              payingWalletId === item.walletId
                            }
                            onClick={() => onPayCard(item)}
                            aria-label={`Registrar pago: ${item.walletName}`}
                          >
                            {payingWalletId === item.walletId ? (
                              <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
                            ) : (
                              <Banknote className="size-3" aria-hidden />
                            )}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="left" sideOffset={6} className="max-w-[220px]">
                        {item.outstandingBalance <= 0 ? (
                          'Sin saldo pendiente en esta tarjeta.'
                        ) : (
                          <>
                            <span className="font-medium">Pagar</span>
                            <span className="mt-0.5 block text-[11px] font-normal opacity-90">
                              Desde efectivo o débito (igual que en Billeteras).
                            </span>
                          </>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default FortnightCardPaymentsPanel;
