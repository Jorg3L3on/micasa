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

/** Calendar-day difference between the statement due date and today (UTC). */
const getDaysLeft = (statementDueDateYmd: string, todayYmd: string): number => {
  const [dy, dm, dd] = statementDueDateYmd.split('-').map((n) => parseInt(n, 10));
  const [ty, tm, td] = todayYmd.split('-').map((n) => parseInt(n, 10));
  if ([dy, dm, dd, ty, tm, td].some((n) => Number.isNaN(n))) return 0;
  const due = Date.UTC(dy, dm - 1, dd);
  const today = Date.UTC(ty, tm - 1, td);
  return Math.round((due - today) / 86_400_000);
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
          'rounded-xl border border-border/40 bg-card px-4 py-8 text-center shadow-sm',
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
      className="overflow-hidden rounded-xl border-border/40 shadow-md"
      role="region"
      aria-label={`Pagos de tarjeta: ${fortnightLabel}`}
    >
      <CardContent className="px-0 pb-1 pt-0">
        <p className="px-4 pt-3 pb-2 text-[10px] font-medium text-muted-foreground/70 leading-snug">
          Monto sugerido según movimientos en MiCasa. El banco puede indicar otro importe.
        </p>
        <div className="divide-y divide-border/30">
          {rows.map((item) => {
            const status = getPlannerCardPaymentStatus(item, todayYmd);
            const Icon = WALLET_TYPE_ICON[item.walletType] ?? CreditCard;
            const href = `/credit-cards/${item.walletId}${ownerQueryString}`;
            const mm = String(plannerMonth).padStart(2, '0');
            const dd = String(item.dueDay).padStart(2, '0');
            const displayDueDateStr = `${plannerYear}-${mm}-${dd}`;
            const displayDueDate = formatDate(displayDueDateStr);
            const daysLeft = getDaysLeft(displayDueDateStr, todayYmd);
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
                  'flex items-center gap-3 px-4 border-l-[3px] transition-colors',
                  isCompact ? 'py-2.5' : 'py-3.5',
                  status === 'vencido' && 'border-l-destructive bg-destructive/3 dark:bg-destructive/5',
                  status === 'por_pagar' && 'border-l-amber-500/70 hover:bg-amber-50/30 dark:hover:bg-amber-950/10',
                  status === 'pagado' && 'border-l-emerald-500/50 bg-emerald-50/10 dark:bg-emerald-950/10',
                )}
              >
                {/* Icon */}
                <span className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1',
                  status === 'pagado'
                    ? 'bg-emerald-500/10 ring-emerald-500/20 dark:bg-emerald-500/15'
                    : status === 'vencido'
                      ? 'bg-destructive/10 ring-destructive/20'
                      : 'bg-violet-500/10 ring-violet-500/20 dark:bg-violet-500/15',
                )}>
                  <Icon className={cn(
                    'h-4 w-4',
                    status === 'pagado'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : status === 'vencido'
                        ? 'text-destructive'
                        : 'text-violet-600 dark:text-violet-400',
                  )} />
                </span>

                {/* Name + status + date */}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={href}
                      className={cn(
                        'truncate font-semibold hover:underline',
                        isCompact ? 'text-xs' : 'text-sm',
                        status === 'pagado' ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {item.walletName}
                    </Link>
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 text-[10px] px-1.5 font-bold',
                        status === 'vencido' &&
                          'border-destructive/50 bg-destructive/8 text-destructive dark:bg-destructive/15',
                        status === 'por_pagar' &&
                          'border-amber-500/50 bg-amber-500/8 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
                        status === 'pagado' &&
                          'border-emerald-500/40 bg-emerald-500/8 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
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
                      <span className={cn('text-[10px] font-semibold tabular-nums', dateColor)}>
                        · {daysLabel}
                      </span>
                    )}
                    {item.cutoff_day != null && (
                      <span className="text-[10px] text-muted-foreground/50">
                        · Corte día {item.cutoff_day}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount + pay button */}
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      'font-mono tabular-nums font-bold',
                      isCompact ? 'text-xs' : 'text-sm',
                      status === 'pagado' ? 'text-muted-foreground/60 line-through' : 'text-foreground',
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
                              'border-border/50 bg-card shadow-none',
                              'transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/8 dark:hover:bg-emerald-500/12',
                              'disabled:pointer-events-none disabled:opacity-40',
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
