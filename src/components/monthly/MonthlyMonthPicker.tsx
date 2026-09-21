'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MONTHLY_ICON_PILL_CLASS } from '@/components/monthly/monthly-panel-shell';
import { parseOwnerQuery } from '@/lib/api/client-fetch';
import { getCreatedMonths } from '@/lib/api/fortnights';
import { cn } from '@/lib/utils';

const MONTH_SHORT_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

type MonthlyMonthPickerProps = {
  year: number;
  month: number;
  monthName: string;
  ownerQuery: string;
  /** Calendar current month (1–12) for highlight. */
  currentYear: number;
  currentMonth: number;
  isCurrentMonth: boolean;
};

export const MonthlyMonthPicker = ({
  year,
  month,
  monthName,
  ownerQuery,
  currentYear,
  currentMonth,
  isCurrentMonth,
}: MonthlyMonthPickerProps) => {
  const router = useRouter();
  // Prefer the page's owner query over FinanceProvider — avoids SSR crashes when
  // this chrome renders before/outside the provider tree.
  const ownerContext = parseOwnerQuery(ownerQuery);
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  /** `null` while unknown / fetch failed — hide planning dots. */
  const [createdKeys, setCreatedKeys] = useState<Set<string> | null>(null);
  const [loadingMonths, setLoadingMonths] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) return;

    setPickerYear(year);
    setLoadingMonths(true);
    void getCreatedMonths(ownerContext)
      .then((list) => {
        setCreatedKeys(
          new Set(list.map((entry) => `${entry.year}-${entry.month}`)),
        );
      })
      .catch(() => {
        setCreatedKeys(null);
      })
      .finally(() => {
        setLoadingMonths(false);
      });
  };

  const handleSelectMonth = (selectedMonth: number) => {
    const mm = String(selectedMonth).padStart(2, '0');
    setOpen(false);
    if (selectedMonth === month && pickerYear === year) return;
    router.push(`/monthly/${pickerYear}/${mm}${ownerQuery}`);
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 px-2.5 py-1.5 text-left',
            'transition-colors hover:bg-muted/20 dark:hover:bg-white/[0.04]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            '@min-[42rem]:flex-none @min-[42rem]:justify-start',
          )}
          aria-label={`Elegir mes: ${monthName} ${year}`}
          aria-live="polite"
        >
          <span
            className={cn('hidden sm:flex', MONTHLY_ICON_PILL_CLASS)}
            aria-hidden
          >
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-col items-center gap-0.5 @min-[42rem]:items-start">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate text-base font-semibold leading-tight tracking-tight sm:text-lg">
                {monthName}
                {year !== currentYear ? (
                  <span className="font-medium text-muted-foreground"> {year}</span>
                ) : null}
              </span>
              <ChevronDown
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </span>
            {isCurrentMonth ? (
              <span className="inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 text-[10px] font-semibold uppercase tracking-wider text-foreground">
                <span
                  className="size-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"
                  aria-hidden
                />
                Actual
              </span>
            ) : null}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[17.5rem] p-2">
        <div className="mb-2 flex items-center justify-between gap-1 px-0.5">
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Año anterior"
            onClick={() => setPickerYear((y) => y - 1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <span className="text-sm font-semibold tabular-nums">{pickerYear}</span>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Año siguiente"
            onClick={() => setPickerYear((y) => y + 1)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        <div
          className={cn(
            'grid grid-cols-3 gap-1',
            loadingMonths && createdKeys == null && 'opacity-70',
          )}
          role="listbox"
          aria-label="Meses"
          aria-busy={loadingMonths}
        >
          {MONTH_SHORT_ES.map((label, index) => {
            const selectedMonth = index + 1;
            const isViewed = pickerYear === year && selectedMonth === month;
            const isCalendarCurrent =
              pickerYear === currentYear && selectedMonth === currentMonth;
            const monthKey = `${pickerYear}-${selectedMonth}`;
            const hasFortnights = createdKeys?.has(monthKey) ?? false;

            return (
              <DropdownMenuItem
                key={label}
                role="option"
                aria-selected={isViewed}
                title={
                  hasFortnights
                    ? `${label} ${pickerYear}: con planificación`
                    : `${label} ${pickerYear}: sin planificación`
                }
                className={cn(
                  'relative justify-center rounded-md px-2 py-2 text-xs font-semibold',
                  isViewed &&
                    'bg-primary text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                  !isViewed &&
                    isCalendarCurrent &&
                    'border border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
                )}
                onSelect={(event) => {
                  event.preventDefault();
                  handleSelectMonth(selectedMonth);
                }}
              >
                {label}
                {hasFortnights ? (
                  <span
                    className={cn(
                      'absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full',
                      isViewed
                        ? 'bg-primary-foreground/80'
                        : 'bg-emerald-500 dark:bg-emerald-400',
                    )}
                    aria-hidden
                  />
                ) : null}
                <span className="sr-only">
                  {hasFortnights
                    ? ', con planificación'
                    : ', sin planificación'}
                </span>
              </DropdownMenuItem>
            );
          })}
        </div>
        {createdKeys != null ? (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <span
              className="h-1 w-1 rounded-full bg-emerald-500 dark:bg-emerald-400"
              aria-hidden
            />
            Con quincenas
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
