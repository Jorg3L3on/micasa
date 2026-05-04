'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import { Banknote, CreditCard, Loader2, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div
      role="region"
      aria-label={`Pagos de tarjeta: ${fortnightLabel}`}
      className="px-1 pb-1"
    >
      <p className="mb-2 px-2 text-[10px] font-medium leading-snug text-muted-foreground/70">
        Monto sugerido según movimientos en MiCasa. El banco puede indicar otro importe.
      </p>
      <ul role="list" className="flex flex-col gap-1.5">
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
              <li
                key={item.walletId}
                className={cn(
                  'group/row relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-3 transition-all',
                  'border-l-[3px]',
                  'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent dark:before:via-white/5',
                  isCompact ? 'py-2.5' : 'py-3',
                  status === 'vencido' &&
                    'border-destructive/25 border-l-destructive bg-gradient-to-br from-destructive/10 via-card to-destructive/3 dark:from-destructive/18 dark:via-card/60 dark:to-destructive/5',
                  status === 'por_pagar' &&
                    'border-amber-500/25 border-l-amber-500/70 bg-gradient-to-br from-amber-500/8 via-card to-amber-500/2 hover:from-amber-500/12 dark:from-amber-500/14 dark:via-card/60 dark:to-amber-500/4',
                  status === 'pagado' &&
                    'border-emerald-500/20 border-l-emerald-500/60 bg-gradient-to-br from-emerald-500/6 via-card to-emerald-500/2 dark:from-emerald-500/12 dark:via-card/60 dark:to-emerald-500/3',
                )}
              >
                {/* Icon badge */}
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1',
                    status === 'pagado'
                      ? 'bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 ring-emerald-500/30 dark:from-emerald-400/25 dark:to-emerald-500/10'
                      : status === 'vencido'
                        ? 'bg-gradient-to-br from-destructive/25 to-destructive/10 ring-destructive/30'
                        : 'bg-gradient-to-br from-violet-500/25 to-violet-600/10 ring-violet-500/30 dark:from-violet-400/25 dark:to-violet-500/10',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      status === 'pagado'
                        ? 'text-emerald-600 dark:text-emerald-300'
                        : status === 'vencido'
                          ? 'text-destructive'
                          : 'text-violet-600 dark:text-violet-300',
                    )}
                    aria-hidden
                  />
                </span>

                {/* Name + status + date */}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={href}
                      className={cn(
                        'min-w-0 truncate font-semibold hover:underline',
                        isCompact ? 'text-xs' : 'text-sm',
                        status === 'pagado'
                          ? 'text-muted-foreground'
                          : 'text-foreground',
                      )}
                    >
                      {item.walletName}
                    </Link>
                    <span
                      className={cn(
                        'inline-flex h-4 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[9px] font-bold uppercase tracking-wider',
                        status === 'vencido' &&
                          'border-destructive/40 bg-destructive/10 text-destructive dark:border-destructive/50 dark:bg-destructive/15',
                        status === 'por_pagar' &&
                          'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-300',
                        status === 'pagado' &&
                          'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-300',
                      )}
                    >
                      <span
                        className={cn(
                          'h-1 w-1 rounded-full',
                          status === 'vencido' && 'bg-destructive',
                          status === 'por_pagar' &&
                            'bg-amber-500 dark:bg-amber-400',
                          status === 'pagado' &&
                            'bg-emerald-500 dark:bg-emerald-400',
                        )}
                        aria-hidden
                      />
                      {statusLabel(status)}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1 text-[10px]">
                    <span
                      className={cn('font-medium tabular-nums', dateColor)}
                    >
                      {displayDueDate}
                    </span>
                    {daysLabel && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span
                          className={cn(
                            'font-semibold tabular-nums',
                            dateColor,
                          )}
                        >
                          {daysLabel}
                        </span>
                      </>
                    )}
                    {item.cutoff_day != null && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-muted-foreground/60">
                          Corte {item.cutoff_day}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount + pay button */}
                <div className="flex shrink-0 items-center gap-2">
                  <div
                    className={cn(
                      'flex items-end gap-2',
                      status === 'pagado'
                        ? 'flex-col items-end gap-0.5'
                        : 'flex-row',
                    )}
                  >
                    <span
                      className={cn(
                        'font-mono font-bold tabular-nums',
                        isCompact ? 'text-xs' : 'text-sm',
                        status === 'pagado'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-foreground',
                      )}
                      aria-label={
                        status === 'pagado'
                          ? `${item.walletName}: pagado al corte ${formatCurrency(
                              item.paymentsAppliedToStatement,
                            )}`
                          : `${item.walletName}: pendiente ${formatCurrency(item.nextDuePayment)}`
                      }
                    >
                      {status === 'pagado'
                        ? formatCurrency(item.paymentsAppliedToStatement)
                        : formatCurrency(item.nextDuePayment)}
                    </span>
                    {status === 'pagado' &&
                    item.paymentsAppliedToStatement > 0 ? (
                      <span
                        className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground/80"
                        aria-hidden
                      >
                        Pagado al corte
                      </span>
                    ) : null}
                  </div>
                  {onPayCard && status !== 'pagado' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={cn(
                              'h-8 w-8 rounded-full border-dashed border-emerald-500/40 bg-transparent shadow-none',
                              'transition-colors hover:border-emerald-500/70 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/15',
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
                              <Loader2
                                className="size-3.5 shrink-0 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <Banknote className="size-3.5" aria-hidden />
                            )}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="left"
                        sideOffset={6}
                        className="max-w-[220px]"
                      >
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
              </li>
            );
          })}
      </ul>
    </div>
  );
};

export default FortnightCardPaymentsPanel;
