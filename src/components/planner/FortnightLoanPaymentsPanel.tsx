'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, HandCoins, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LoanDuePaymentItem } from '@/types/loans';
import { groupDuePaymentsByLender } from '@/lib/finance/lender-payment-window';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useHydrationSafeTodayYmd } from '@/hooks/use-hydration-safe-today-ymd';
import {
  sortLoanDuePaymentRows,
  type PlannerListSortDir,
  type PlannerListSortMode,
} from '@/lib/finance/planner-list-sort';

type FortnightLoanPaymentsPanelProps = {
  items: LoanDuePaymentItem[];
  ownerQueryString: string;
  fortnightLabel: string;
  isCompact?: boolean;
  sortMode?: PlannerListSortMode;
  sortDir?: PlannerListSortDir;
};

type VisualStatus = 'paid' | 'overdue' | 'pending' | 'muted';

const getDaysLeft = (dueDateYmd: string, todayYmd: string): number => {
  const [dy, dm, dd] = dueDateYmd.split('-').map((n) => parseInt(n, 10));
  const [ty, tm, td] = todayYmd.split('-').map((n) => parseInt(n, 10));
  if ([dy, dm, dd, ty, tm, td].some((n) => Number.isNaN(n))) return 0;
  const due = Date.UTC(dy, dm - 1, dd);
  const today = Date.UTC(ty, tm - 1, td);
  return Math.round((due - today) / 86_400_000);
};

const getVisualStatus = (
  item: LoanDuePaymentItem,
  todayYmd: string,
): VisualStatus => {
  if (item.status === 'PAID') return 'paid';
  if (item.status === 'CANCELLED' || item.status === 'SKIPPED') return 'muted';
  if (item.dueDate < todayYmd) return 'overdue';
  return 'pending';
};

export default function FortnightLoanPaymentsPanel({
  items,
  ownerQueryString,
  fortnightLabel,
  isCompact = false,
  sortMode = 'amount',
  sortDir = 'desc',
}: FortnightLoanPaymentsPanelProps) {
  const todayYmd = useHydrationSafeTodayYmd();

  const rows = useMemo(
    () => sortLoanDuePaymentRows(items, sortMode, sortDir, todayYmd),
    [items, sortMode, sortDir, todayYmd],
  );

  const groups = useMemo(() => groupDuePaymentsByLender(rows), [rows]);

  const lenderHref = (lenderId: number | null, loanId: number) => {
    const params = new URLSearchParams(
      ownerQueryString.startsWith('?')
        ? ownerQueryString.slice(1)
        : ownerQueryString,
    );
    if (lenderId != null) params.set('lenderId', String(lenderId));
    params.set('loanId', String(loanId));
    const qs = params.toString();
    return qs ? `/loans?${qs}` : '/loans';
  };

  if (groups.length === 0) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border/40 bg-card px-4 py-8 text-center shadow-sm',
          isCompact ? 'text-xs' : 'text-sm',
        )}
        role="region"
        aria-label={`Préstamos: ${fortnightLabel}`}
      >
        <p className="text-muted-foreground">
          No hay pagos de préstamos en esta quincena.
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={`Préstamos: ${fortnightLabel}`}
      className="px-1 pb-1"
    >
      <ul role="list" className="flex flex-col gap-1.5">
        {groups.map((group) => {
          const visual = group.items.reduce<VisualStatus>((current, item) => {
            const next = getVisualStatus(item, todayYmd);
            if (next === 'overdue' || current === 'overdue') return 'overdue';
            if (next === 'pending' || current === 'pending') return 'pending';
            if (next === 'paid') return current === 'muted' ? 'paid' : next;
            return current;
          }, 'muted');
          const daysLeft = getDaysLeft(group.dueDate, todayYmd);
          const isPayroll = group.paymentSource === 'PAYROLL_DEDUCTION';
          const Icon = isPayroll ? Landmark : HandCoins;
          const isDueSoon = visual === 'pending' && daysLeft <= 7;
          const isDueLater = visual === 'pending' && daysLeft > 7;
          const canPay =
            !isPayroll &&
            group.items.some((item) => item.status === 'SCHEDULED');
          const firstLoanId = group.items[0]?.loanId ?? 0;
          const href = lenderHref(group.lenderId, firstLoanId);

          return (
            <li
              key={group.key}
              className={cn(
                'group/row relative overflow-hidden rounded-xl border px-3 transition-all',
                isCompact ? 'py-2.5' : 'py-3',
                visual === 'overdue' &&
                  'border-destructive/25 bg-gradient-to-br from-destructive/10 via-card to-destructive/3 dark:from-destructive/18 dark:via-card/60 dark:to-destructive/5',
                isDueSoon &&
                  'border-amber-500/25 bg-gradient-to-br from-amber-500/8 via-card to-amber-500/2 hover:from-amber-500/12 dark:from-amber-500/14 dark:via-card/60 dark:to-amber-500/4',
                isDueLater &&
                  'border-blue-500/25 bg-gradient-to-br from-blue-500/8 via-card to-blue-500/2 hover:from-blue-500/12 dark:from-blue-500/14 dark:via-card/60 dark:to-blue-500/4',
                visual === 'paid' &&
                  'border-emerald-500/20 bg-gradient-to-br from-emerald-500/6 via-card to-emerald-500/2 dark:from-emerald-500/12 dark:via-card/60 dark:to-emerald-500/3',
                visual === 'muted' && 'border-border/50 bg-muted/20 opacity-80',
              )}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1',
                    visual === 'paid'
                      ? 'bg-gradient-to-br from-emerald-500/25 to-emerald-600/10 ring-emerald-500/30 dark:from-emerald-400/25 dark:to-emerald-500/10'
                      : visual === 'overdue'
                        ? 'bg-gradient-to-br from-destructive/25 to-destructive/10 ring-destructive/30'
                        : visual === 'muted'
                          ? 'bg-muted/40 ring-border/40'
                          : isDueSoon
                            ? 'bg-gradient-to-br from-amber-500/25 to-amber-600/10 ring-amber-500/30 dark:from-amber-400/25 dark:to-amber-500/10'
                            : 'bg-gradient-to-br from-blue-500/25 to-blue-600/10 ring-blue-500/30 dark:from-blue-400/25 dark:to-blue-500/10',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4',
                      visual === 'paid'
                        ? 'text-emerald-600 dark:text-emerald-300'
                        : visual === 'overdue'
                          ? 'text-destructive'
                          : visual === 'muted'
                            ? 'text-muted-foreground'
                            : isDueSoon
                              ? 'text-amber-600 dark:text-amber-300'
                              : 'text-blue-600 dark:text-blue-300',
                    )}
                    aria-hidden
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <Link
                    href={href}
                    className={cn(
                      'block min-w-0 truncate font-semibold hover:underline',
                      isCompact ? 'text-xs' : 'text-sm',
                      visual === 'paid' || visual === 'muted'
                        ? 'text-muted-foreground'
                        : 'text-foreground',
                    )}
                  >
                    {isPayroll
                      ? `Nómina · ${group.lenderName}`
                      : `Pagar a ${group.lenderName}`}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span>
                      {group.items.length} contrato
                      {group.items.length === 1 ? '' : 's'}
                    </span>
                    <span className="text-muted-foreground/30">·</span>
                    <span>
                      {group.isRange
                        ? `${formatDate(group.dueDate)} – ${formatDate(group.dueDateEnd)}`
                        : formatDate(group.dueDate)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-sm font-bold tabular-nums">
                    {formatCurrency(group.amount)}
                  </span>
                  {canPay ? (
                    <Button
                      type="button"
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-[10px]"
                    >
                      <Link href={href}>
                        <ArrowRight className="h-3 w-3" aria-hidden />
                        Pagar
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>

              {group.items.length > 1 ? (
                <ul className="mt-2 space-y-1 border-t border-border/40 pt-2">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground"
                    >
                      <span className="truncate">{item.loanName}</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
