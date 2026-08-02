'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, HandCoins, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LoanDuePaymentItem } from '@/types/loans';
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

/** Calendar-day difference between due date and today (UTC). */
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

  const loanHref = (item: LoanDuePaymentItem) =>
    `/loans${
      ownerQueryString
        ? `${ownerQueryString}&loanId=${item.loanId}`
        : `?loanId=${item.loanId}`
    }`;

  if (rows.length === 0) {
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
        {rows.map((item) => {
          const visual = getVisualStatus(item, todayYmd);
          const daysLeft = getDaysLeft(item.dueDate, todayYmd);
          const Icon =
            item.paymentSource === 'PAYROLL_DEDUCTION' ? Landmark : HandCoins;
          const isDueSoon = visual === 'pending' && daysLeft <= 7;
          const isDueLater = visual === 'pending' && daysLeft > 7;
          return (
            <li
              key={item.id}
              className={cn(
                'group/row relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-3 transition-all',
                'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent dark:before:via-white/5',
                isCompact ? 'py-2.5' : 'py-3',
                visual === 'overdue' &&
                  'border-destructive/25 bg-gradient-to-br from-destructive/10 via-card to-destructive/3 dark:from-destructive/18 dark:via-card/60 dark:to-destructive/5',
                isDueSoon &&
                  'border-amber-500/25 bg-gradient-to-br from-amber-500/8 via-card to-amber-500/2 hover:from-amber-500/12 dark:from-amber-500/14 dark:via-card/60 dark:to-amber-500/4',
                isDueLater &&
                  'border-blue-500/25 bg-gradient-to-br from-blue-500/8 via-card to-blue-500/2 hover:from-blue-500/12 dark:from-blue-500/14 dark:via-card/60 dark:to-blue-500/4',
                visual === 'paid' &&
                  'border-emerald-500/20 bg-gradient-to-br from-emerald-500/6 via-card to-emerald-500/2 dark:from-emerald-500/12 dark:via-card/60 dark:to-emerald-500/3',
                visual === 'muted' &&
                  'border-border/50 bg-muted/20 opacity-80',
              )}
            >
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
                  href={loanHref(item)}
                  className={cn(
                    'block min-w-0 truncate font-semibold hover:underline',
                    isCompact ? 'text-xs' : 'text-sm',
                    visual === 'paid' || visual === 'muted'
                      ? 'text-muted-foreground'
                      : 'text-foreground',
                  )}
                >
                  {item.loanName}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>{item.lender}</span>
                  <span className="text-muted-foreground/30">·</span>
                  <span>{formatDate(item.dueDate)}</span>
                  <span className="text-muted-foreground/30">·</span>
                  <span>
                    {item.paymentSource === 'PAYROLL_DEDUCTION'
                      ? `Nómina${item.incomeTemplateName ? `: ${item.incomeTemplateName}` : ''}`
                      : item.sourceWalletName ?? 'Billetera'}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-sm font-bold tabular-nums">
                  {formatCurrency(item.amount)}
                </span>
                {item.status === 'SCHEDULED' ? (
                  <Button
                    type="button"
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 px-2 text-[10px]"
                  >
                    <Link href={loanHref(item)}>
                      <ArrowRight className="h-3 w-3" aria-hidden />
                      Gestionar
                    </Link>
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
