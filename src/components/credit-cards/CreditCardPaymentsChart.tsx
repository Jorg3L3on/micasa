'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MoreVertical, Pencil, Trash2, TrendingUp } from 'lucide-react';
import { todayCalendarDate } from '@/lib/calendar-dates';
import {
  buildUpcomingCreditCardPaymentSources,
  buildUpcomingCreditCardPaymentsChart,
  type UpcomingPaymentSourceRow,
  type UpcomingPaymentsChartPoint,
} from '@/lib/finance/credit-card-upcoming-payments-chart';
import type {
  CreditCardInstallmentPlanItem,
  CreditCardPaymentListItem,
  CreditCardScheduledPaymentItem,
  CreditCardStatementPurchaseItem,
} from '@/types/catalog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

type TooltipProps = {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: UpcomingPaymentsChartPoint;
  }>;
  label?: string;
};

const PaymentsTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-md border border-border/60 bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {point.paid > 0 ? (
        <p className="font-mono tabular-nums text-blue-500">
          Pagos realizados: {formatCurrency(point.paid)}
        </p>
      ) : null}
      {point.msi > 0 ? (
        <p className="font-mono tabular-nums text-violet-600 dark:text-violet-400">
          Compras a meses: {formatCurrency(point.msi)}
        </p>
      ) : null}
      {point.plans > 0 ? (
        <p className="font-mono tabular-nums text-amber-700 dark:text-amber-400">
          Planes a meses: {formatCurrency(point.plans)}
        </p>
      ) : null}
      {point.scheduled > 0 ? (
        <p className="font-mono tabular-nums text-amber-600 dark:text-amber-300">
          Pagos programados: {formatCurrency(point.scheduled)}
        </p>
      ) : null}
      {point.pending > 0 ? (
        <p className="mt-1 font-mono tabular-nums text-muted-foreground">
          Por pagar: {formatCurrency(point.pending)}
        </p>
      ) : null}
    </div>
  );
};

const shortAxisMoney = (n: number): string => {
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(Math.round(n));
};

const sourceKindLabel: Record<UpcomingPaymentSourceRow['kind'], string> = {
  scheduled: 'Programado',
  msi: 'MSI',
  plan: 'Plan',
};

type Props = {
  paymentHistory: CreditCardPaymentListItem[];
  installmentActivePurchases: CreditCardStatementPurchaseItem[];
  statementEnd: string;
  scheduledPayments?: CreditCardScheduledPaymentItem[];
  installmentPlans?: CreditCardInstallmentPlanItem[];
  ownerQueryString?: string;
  onEditScheduled?: (item: CreditCardScheduledPaymentItem) => void;
  onDeleteScheduled?: (item: CreditCardScheduledPaymentItem) => void;
};

export const CreditCardPaymentsChart = ({
  paymentHistory,
  installmentActivePurchases,
  statementEnd,
  scheduledPayments = [],
  installmentPlans = [],
  ownerQueryString = '',
  onEditScheduled,
  onDeleteScheduled,
}: Props) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Theme-dependent chart colors must wait for client mount.
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === 'dark';
  const axisColor = isDark ? '#a1a1aa' : '#71717a';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const blue = isDark ? '#60a5fa' : '#3b82f6';
  const amber = isDark ? '#fbbf24' : '#d97706';
  const amberMuted = isDark ? 'rgba(251, 191, 36, 0.35)' : 'rgba(217, 119, 6, 0.35)';
  const fromMonthKey = todayCalendarDate().slice(0, 7);

  const chartInput = useMemo(
    () => ({
      paymentHistory,
      installmentActivePurchases,
      statementEnd,
      scheduledPayments,
      installmentPlans,
      fromMonthKey,
    }),
    [
      paymentHistory,
      installmentActivePurchases,
      statementEnd,
      scheduledPayments,
      installmentPlans,
      fromMonthKey,
    ],
  );

  const data = useMemo(
    () => buildUpcomingCreditCardPaymentsChart(chartInput),
    [chartInput],
  );

  const sources = useMemo(
    () => buildUpcomingCreditCardPaymentSources(chartInput, ownerQueryString),
    [chartInput, ownerQueryString],
  );

  const pendingMonths = useMemo(
    () => data.filter((point) => point.pending > 0),
    [data],
  );

  const paidScheduled = useMemo(
    () => scheduledPayments.filter((item) => item.status === 'PAID'),
    [scheduledPayments],
  );

  const hasData = data.some((d) => d.paid > 0 || d.pending > 0);
  const lastLabel = data.at(-1)?.label;
  const activeMonthKey =
    selectedMonthKey && pendingMonths.some((m) => m.monthKey === selectedMonthKey)
      ? selectedMonthKey
      : (pendingMonths[0]?.monthKey ?? null);

  const scheduledById = useMemo(() => {
    const map = new Map<number, CreditCardScheduledPaymentItem>();
    for (const item of scheduledPayments) {
      map.set(item.id, item);
    }
    return map;
  }, [scheduledPayments]);

  const handleBarClick = (point: UpcomingPaymentsChartPoint | undefined) => {
    if (!point || point.pending <= 0) return;
    setSelectedMonthKey(point.monthKey);
    const node = document.getElementById(`chart-month-${point.monthKey}`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const handleSourceSubtitle = (row: UpcomingPaymentSourceRow) => {
    if (row.kind === 'msi') return row.subtitle;
    if (row.dueDate) return `Vence ${formatDate(row.dueDate)}`;
    return row.subtitle;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-500/15">
          <TrendingUp
            className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400"
            data-icon="inline-start"
          />
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold leading-none">
            Por pagar de aquí en adelante
          </h4>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {lastLabel
              ? `Este mes hasta ${lastLabel} · toca una barra para ver de qué se arma`
              : 'Cuotas MSI, planes y pagos programados'}
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {!hasData ? (
          <p className="text-sm text-muted-foreground">
            No hay pagos ni cuotas pendientes desde este mes.
          </p>
        ) : (
          <>
            <div className="h-52 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={gridColor}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: axisColor }}
                    tickLine={false}
                    axisLine={{ stroke: gridColor }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: axisColor }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tickFormatter={shortAxisMoney}
                  />
                  <Tooltip
                    content={<PaymentsTooltip />}
                    cursor={{ fill: gridColor }}
                  />
                  <Legend
                    formatter={(value) =>
                      value === 'paid' ? 'Pagos realizados' : 'Por pagar'
                    }
                    wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                  />
                  <Bar
                    dataKey="paid"
                    name="paid"
                    fill={blue}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="pending"
                    name="pending"
                    fill={amber}
                    radius={[4, 4, 0, 0]}
                    cursor="pointer"
                  >
                    {data.map((point) => (
                      <Cell
                        key={point.monthKey}
                        fill={
                          !activeMonthKey || point.monthKey === activeMonthKey
                            ? amber
                            : amberMuted
                        }
                        onClick={() => handleBarClick(point)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {pendingMonths.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Desglose de la gráfica
                </p>
                <div className="space-y-2">
                  {pendingMonths.map((month) => {
                    const monthSources = sources.filter(
                      (row) => row.monthKey === month.monthKey,
                    );
                    const isActive = month.monthKey === activeMonthKey;
                    return (
                      <div
                        key={month.monthKey}
                        id={`chart-month-${month.monthKey}`}
                        className={cn(
                          'rounded-xl border border-border/60 bg-card/40',
                          isActive &&
                            'border-amber-500/40 ring-1 ring-amber-500/20',
                        )}
                      >
                        <button
                          type="button"
                          className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left"
                          onClick={() => setSelectedMonthKey(month.monthKey)}
                          aria-pressed={isActive}
                          aria-label={`Ver ${month.label}`}
                        >
                          <span className="text-xs font-semibold capitalize text-foreground">
                            {month.label}
                          </span>
                          <span className="font-mono text-xs font-bold tabular-nums text-amber-600 dark:text-amber-400">
                            {formatCurrency(month.pending)}
                          </span>
                        </button>
                        <ul className="border-t border-border/40">
                          {monthSources.map((row) => {
                            const scheduled =
                              row.scheduledPaymentId != null
                                ? scheduledById.get(row.scheduledPaymentId)
                                : undefined;
                            const body = (
                              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {row.title}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    <span className="font-semibold uppercase tracking-wider">
                                      {sourceKindLabel[row.kind]}
                                    </span>
                                    {' · '}
                                    {handleSourceSubtitle(row)}
                                  </p>
                                </div>
                                <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                                  {formatCurrency(row.amount)}
                                </span>
                              </div>
                            );

                            return (
                              <li
                                key={row.id}
                                className="flex items-center gap-1 px-3 py-2"
                              >
                                {row.fortnightHref ? (
                                  <Link
                                    href={row.fortnightHref}
                                    className="min-w-0 flex-1 rounded-md transition-colors hover:bg-muted/40"
                                  >
                                    {body}
                                  </Link>
                                ) : (
                                  body
                                )}
                                {scheduled && onEditScheduled && onDeleteScheduled ? (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 shrink-0"
                                        aria-label={`Opciones para ${row.title}`}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-40">
                                      <DropdownMenuItem
                                        onClick={() => onEditScheduled(scheduled)}
                                      >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Editar
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() =>
                                          void onDeleteScheduled(scheduled)
                                        }
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Eliminar
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                ) : null}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {paidScheduled.length > 0 ? (
              <details className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                  {paidScheduled.length} cuota
                  {paidScheduled.length === 1 ? '' : 's'} cubierta
                  {paidScheduled.length === 1 ? '' : 's'}
                </summary>
                <ul className="mt-2 space-y-1">
                  {paidScheduled.map((item) => (
                    <li
                      key={item.id}
                      className="flex justify-between gap-2 text-xs text-muted-foreground"
                    >
                      <span className="truncate">
                        {item.label ?? 'Pago programado'} ·{' '}
                        {formatDate(item.dueDate)}
                      </span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
};
