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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DuePaymentItem } from '@/types/catalog';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

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
  isCompact?: boolean;
  onPayCard?: (item: DuePaymentItem) => void;
  /** Mientras se cargan billeteras/categorías para el diálogo de pago */
  payingWalletId?: number | null;
};

const FortnightCardPaymentsPanel = ({
  items,
  ownerQueryString,
  fortnightLabel,
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
      <CardContent className="px-0 pb-3 pt-0">
        <p
          className={cn(
            'px-3 pt-3 pb-2 text-[10px] text-muted-foreground leading-snug',
          )}
        >
          Monto sugerido según movimientos en MiCasa. El banco puede indicar otro
          importe.
        </p>
        <div className="relative w-full overflow-x-auto scrollbar-hide">
          <Table className={isCompact ? 'text-xs' : undefined}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead
                  className={cn(
                    'font-medium min-w-[140px]',
                    isCompact ? 'text-[10px] h-9' : 'text-xs',
                  )}
                >
                  Tarjeta
                </TableHead>
                <TableHead
                  className={cn(
                    'text-right font-medium min-w-[100px]',
                    isCompact ? 'text-[10px] h-9' : 'text-xs',
                  )}
                >
                  Monto
                </TableHead>
                <TableHead
                  className={cn(
                    'font-medium min-w-[120px]',
                    isCompact ? 'text-[10px] h-9' : 'text-xs',
                  )}
                >
                  Último día pago
                </TableHead>
                <TableHead
                  className={cn(
                    'text-center font-medium min-w-[72px]',
                    isCompact ? 'text-[10px] h-9' : 'text-xs',
                  )}
                >
                  Corte
                </TableHead>
                <TableHead
                  className={cn(
                    'font-medium min-w-[100px]',
                    isCompact ? 'text-[10px] h-9' : 'text-xs',
                  )}
                >
                  Estado
                </TableHead>
                {onPayCard ? (
                  <TableHead
                    className={cn(
                      'w-10 max-w-10 min-w-10 p-0 text-center font-medium',
                      isCompact ? 'h-9' : '',
                    )}
                  >
                    <span className="sr-only">Pago</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => {
                const status = getPlannerCardPaymentStatus(item, todayYmd);
                const Icon = WALLET_TYPE_ICON[item.walletType] ?? CreditCard;
                const href = `/credit-cards/${item.walletId}${ownerQueryString}`;
                return (
                  <TableRow
                    key={item.walletId}
                    className={cn(
                      'border-l-[3px]',
                      status === 'vencido' && 'border-l-destructive/50',
                      status === 'por_pagar' && 'border-l-amber-500/50',
                      status === 'pagado' && 'border-l-emerald-500/40',
                    )}
                  >
                    <TableCell className={cn(isCompact && 'py-2')}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-500/10 dark:bg-violet-500/15">
                          <Icon className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                        </span>
                        <Link
                          href={href}
                          className={cn(
                            'font-medium truncate hover:underline text-foreground',
                            isCompact ? 'text-xs' : 'text-sm',
                          )}
                        >
                          {item.walletName}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono tabular-nums font-semibold',
                        isCompact ? 'text-xs' : 'text-sm',
                        status === 'pagado' && 'text-muted-foreground',
                      )}
                    >
                      {formatCurrency(item.nextDuePayment)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-muted-foreground',
                        isCompact ? 'text-xs' : 'text-sm',
                      )}
                    >
                      <span className="block font-medium text-foreground tabular-nums">
                        {formatDate(item.statementDueDate)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Vence día {item.dueDay}
                      </span>
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-center tabular-nums',
                        isCompact ? 'text-xs' : 'text-sm',
                      )}
                    >
                      Día {item.cutoff_day}
                    </TableCell>
                    <TableCell className={isCompact ? 'py-2' : undefined}>
                      <Badge
                        variant={
                          status === 'vencido'
                            ? 'destructive'
                            : status === 'pagado'
                              ? 'secondary'
                              : 'outline'
                        }
                        className={cn(
                          'text-[10px]',
                          status === 'por_pagar' &&
                            'border-amber-500/50 text-amber-800 dark:text-amber-300',
                          status === 'pagado' &&
                            'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
                        )}
                      >
                        {statusLabel(status)}
                      </Badge>
                    </TableCell>
                    {onPayCard ? (
                      <TableCell
                        className={cn(
                          'w-10 max-w-10 min-w-10 p-1 align-middle text-center',
                        )}
                      >
                        {status === 'pagado' ? null : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex justify-center">
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
                                    <Loader2
                                      className="size-3 shrink-0 animate-spin"
                                      aria-hidden
                                    />
                                  ) : (
                                    <Banknote className="size-3" aria-hidden />
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
                                    Desde efectivo o débito (igual que en
                                    Billeteras).
                                  </span>
                                </>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default FortnightCardPaymentsPanel;
