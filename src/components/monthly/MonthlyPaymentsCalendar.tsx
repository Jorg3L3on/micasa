'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Money } from '@/components/money';
import {
  MONTHLY_ICON_PILL_CLASS,
  MONTHLY_LIQUID_PANEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { EASE_OUT, SPRING_PRESS } from '@/components/motion/ease';
import { Tooltip } from '@/components/motion/tooltip';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import { SegmentedControl } from '@/components/segmented-control';
import { Button } from '@/components/ui/button';
import { useFinanceContext } from '@/context/finance-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { addCalendarDays } from '@/lib/calendar-dates';
import { clientFetchFromApi } from '@/lib/api/client-fetch';
import {
  getCreatedMonths,
  type CreatedMonth,
} from '@/lib/api/fortnights';
import {
  defaultSelectedDayInWindow,
  fortnightRefForWindow,
  monthBounds,
  neighborWindow,
  pendingDatesFromCalendarItems,
  resolveInitialWindow,
  type CalendarViewMode,
  type CalendarWindowBounds,
  windowMonths,
  itemsForCalendarDate,
} from '@/lib/finance/payments-calendar';
import { getDaysInCalendarMonth } from '@/lib/fortnight-calendar';
import { useHoverCapable } from '@/lib/hooks/use-hover-capable';
import { cn, formatCurrency } from '@/lib/utils';
import type {
  PaymentsCalendarItem,
  PaymentsCalendarResult,
} from '@/types/payments-calendar';

const XL_BREAKPOINT_PX = 1280;

/** Matches Tailwind `xl` — sidebar calendar breakpoint. */
function useIsXlUp() {
  const [isXlUp, setIsXlUp] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${XL_BREAKPOINT_PX}px)`);
    const update = () => setIsXlUp(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isXlUp;
}

/** Pending payment cell fill — exact product color. */
const PENDING_CELL_COLOR = '#F09343';
/** Today day-number color when that civil day is visible. */
const TODAY_NUMBER_COLOR = '#EB4C46';

const WEEKDAY_LABELS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'] as const;

const VIEW_MODE_OPTIONS = [
  { value: 'week', label: 'Semanal' },
  { value: 'fortnight', label: 'Quincenal' },
  { value: 'month', label: 'Mensual' },
] as const;

type MonthlyPaymentsCalendarProps = {
  /** Panel financiero year — seeds initial month window only. */
  year: number;
  /** Panel financiero month — seeds initial month window only. */
  month: number;
  /** SSR / panel items for the Panel month (hydration). */
  items: PaymentsCalendarItem[];
  todayYmd: string;
  /** Incremented by the panel on in-place refresh; re-fetches the viewed window. */
  refreshNonce?: number;
  className?: string;
};

const ymdFromParts = (year: number, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const parseYmdParts = (
  ymd: string,
): { year: number; month: number; day: number } => {
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
};

/** Sentence-case a locale date string without CSS capitalize (avoids "De"). */
const sentenceCaseEs = (value: string): string =>
  value.length === 0
    ? value
    : `${value.charAt(0).toLocaleUpperCase('es-MX')}${value.slice(1)}`;

const formatDayHeading = (ymd: string): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  return sentenceCaseEs(
    new Intl.DateTimeFormat('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(y, m - 1, d)),
  );
};

const formatMonthTitle = (year: number, month: number): string =>
  sentenceCaseEs(
    new Intl.DateTimeFormat('es-MX', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, 1)),
  );

const formatShortDayMonth = (ymd: string): string => {
  const { year, month, day } = parseYmdParts(ymd);
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(year, month - 1, day));
};

const formatWeekTitle = (bounds: CalendarWindowBounds): string => {
  const start = parseYmdParts(bounds.startYmd);
  const end = parseYmdParts(bounds.endYmd);
  const startLabel = formatShortDayMonth(bounds.startYmd);
  const endLabel = formatShortDayMonth(bounds.endYmd);
  const year =
    start.year === end.year ? String(start.year) : `${start.year}/${end.year}`;
  return `${startLabel} – ${endLabel} ${year}`;
};

const formatFortnightTitle = (bounds: CalendarWindowBounds): string => {
  const ref = fortnightRefForWindow(bounds);
  const ordinal = ref.period === 'FIRST' ? '1.ª' : '2.ª';
  const monthLabel = new Intl.DateTimeFormat('es-MX', {
    month: 'long',
  }).format(new Date(ref.year, ref.month - 1, 1));
  return `${ordinal} quincena · ${monthLabel} ${ref.year}`;
};

const formatWindowTitle = (
  mode: CalendarViewMode,
  bounds: CalendarWindowBounds,
): string => {
  if (mode === 'week') return formatWeekTitle(bounds);
  if (mode === 'fortnight') return formatFortnightTitle(bounds);
  const { year, month } = parseYmdParts(bounds.startYmd);
  return formatMonthTitle(year, month);
};

/** Soft fill from pending count, always anchored on PENDING_CELL_COLOR. */
const pendingTint = (count: number, hot: boolean): string | undefined => {
  if (count <= 0) return undefined;
  const strength = Math.round(Math.min(count / 4, 1) * 20 + (hot ? 18 : 42));
  return `color-mix(in srgb, ${PENDING_CELL_COLOR} ${strength}%, transparent)`;
};

type DayCellModel = {
  day: number;
  ymd: string;
  count: number;
};

const countByDate = (
  items: PaymentsCalendarItem[],
): Map<string, number> => {
  const byDate = new Map<string, number>();
  for (const item of items) {
    byDate.set(item.date, (byDate.get(item.date) ?? 0) + 1);
  }
  return byDate;
};

const buildMonthCells = (
  year: number,
  month: number,
  byDate: Map<string, number>,
): Array<DayCellModel | null> => {
  const daysInMonth = getDaysInCalendarMonth(year, month);
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const cells: Array<DayCellModel | null> = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const ymd = ymdFromParts(year, month, day);
    cells.push({ day, ymd, count: byDate.get(ymd) ?? 0 });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const buildWindowCells = (
  mode: CalendarViewMode,
  bounds: CalendarWindowBounds,
  items: PaymentsCalendarItem[],
): Array<DayCellModel | null> => {
  const byDate = countByDate(items);

  if (mode === 'month') {
    const { year, month } = parseYmdParts(bounds.startYmd);
    return buildMonthCells(year, month, byDate);
  }

  if (mode === 'week') {
    const cells: DayCellModel[] = [];
    let cursor = bounds.startYmd;
    while (cursor <= bounds.endYmd) {
      const day = Number(cursor.slice(8, 10));
      cells.push({ day, ymd: cursor, count: byDate.get(cursor) ?? 0 });
      cursor = addCalendarDays(cursor, 1);
    }
    return cells;
  }

  // Fortnight: Monday-first padding like the month grid.
  const { year, month, day } = parseYmdParts(bounds.startYmd);
  const firstDow = (new Date(year, month - 1, day).getDay() + 6) % 7;
  const cells: Array<DayCellModel | null> = [];
  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  let cursor = bounds.startYmd;
  while (cursor <= bounds.endYmd) {
    const d = Number(cursor.slice(8, 10));
    cells.push({ day: d, ymd: cursor, count: byDate.get(cursor) ?? 0 });
    cursor = addCalendarDays(cursor, 1);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const AgendaList = ({
  items,
  emptyClassName,
}: {
  items: PaymentsCalendarItem[];
  emptyClassName?: string;
}) => {
  if (items.length === 0) {
    return (
      <p
        className={cn(
          'py-3 text-center text-caption text-muted-foreground',
          emptyClassName,
        )}
      >
        Sin pagos pendientes
      </p>
    );
  }
  return (
    <ul className="space-y-1.5" role="list">
      {items.map((item) => (
        <CalendarAgendaRow
          key={`${item.type}-${item.sourceId}-${item.date}`}
          item={item}
        />
      ))}
    </ul>
  );
};

const CalendarAgendaRow = ({ item }: { item: PaymentsCalendarItem }) => (
  <li className="flex min-w-0 items-center gap-2 rounded-xl border border-border/40 bg-background/40 px-2.5 py-2 dark:bg-black/20">
    <span className="shrink-0 rounded-md bg-muted/50 px-1.5 py-0.5 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
      {item.typeLabel}
    </span>
    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
      {item.name}
    </span>
    {item.amount != null ? (
      <Money
        value={item.amount}
        size="caption"
        tone="neutral"
        className="shrink-0"
      />
    ) : (
      <span className="shrink-0 text-caption text-muted-foreground">—</span>
    )}
  </li>
);

export const MonthlyPaymentsCalendar = ({
  year,
  month,
  items: initialItems,
  todayYmd,
  refreshNonce = 0,
  className,
}: MonthlyPaymentsCalendarProps) => {
  const { context } = useFinanceContext();
  const canHover = useHoverCapable();
  const isMobile = useIsMobile();
  const isXlUp = useIsXlUp();
  const reduce = useReducedMotion();
  const tooltipId = useId();
  const gridRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [windowBounds, setWindowBounds] = useState<CalendarWindowBounds>(() =>
    monthBounds(year, month),
  );
  const [items, setItems] = useState(initialItems);
  const [createdMonths, setCreatedMonths] = useState<CreatedMonth[] | null>(
    null,
  );
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [hoverYmd, setHoverYmd] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [selectedYmd, setSelectedYmd] = useState(() =>
    defaultSelectedDayInWindow({
      startYmd: monthBounds(year, month).startYmd,
      endYmd: monthBounds(year, month).endYmd,
      todayYmd,
      pendingDates: pendingDatesFromCalendarItems(initialItems),
    }),
  );

  const cells = useMemo(
    () => buildWindowCells(viewMode, windowBounds, items),
    [viewMode, windowBounds, items],
  );

  const maxPending = useMemo(
    () => cells.reduce((max, cell) => Math.max(max, cell?.count ?? 0), 1),
    [cells],
  );

  const dayItems = useMemo(
    () => itemsForCalendarDate(items, selectedYmd),
    [items, selectedYmd],
  );

  const dayTotal = useMemo(
    () =>
      dayItems.reduce(
        (sum, item) => sum + (item.amount != null ? item.amount : 0),
        0,
      ),
    [dayItems],
  );

  const hoverItems = useMemo(
    () => (hoverYmd ? itemsForCalendarDate(items, hoverYmd) : []),
    [hoverYmd, items],
  );

  const hoverTotal = useMemo(
    () =>
      hoverItems.reduce(
        (sum, item) => sum + (item.amount != null ? item.amount : 0),
        0,
      ),
    [hoverItems],
  );

  const periodTitle = useMemo(
    () => formatWindowTitle(viewMode, windowBounds),
    [viewMode, windowBounds],
  );

  const prevWindow = useMemo(
    () =>
      createdMonths
        ? neighborWindow(viewMode, windowBounds, -1, createdMonths)
        : null,
    [createdMonths, viewMode, windowBounds],
  );
  const nextWindow = useMemo(
    () =>
      createdMonths
        ? neighborWindow(viewMode, windowBounds, 1, createdMonths)
        : null,
    [createdMonths, viewMode, windowBounds],
  );

  const applyWindowData = useCallback(
    (bounds: CalendarWindowBounds, nextItems: PaymentsCalendarItem[]) => {
      const pending = pendingDatesFromCalendarItems(nextItems);
      setWindowBounds(bounds);
      setItems(nextItems);
      setHoverYmd(null);
      setSheetOpen(false);
      setSelectedYmd(
        defaultSelectedDayInWindow({
          startYmd: bounds.startYmd,
          endYmd: bounds.endYmd,
          todayYmd,
          pendingDates: pending,
        }),
      );
    },
    [todayYmd],
  );

  const fetchMonth = useCallback(
    async (targetYear: number, targetMonth: number) => {
      const mm = String(targetMonth).padStart(2, '0');
      return clientFetchFromApi<PaymentsCalendarResult>(
        `/api/monthly/${targetYear}/${mm}/payments-calendar`,
        undefined,
        context,
      );
    },
    [context],
  );

  const fetchWindow = useCallback(
    async (bounds: CalendarWindowBounds) => {
      const months = windowMonths(bounds.startYmd, bounds.endYmd);
      const results = await Promise.all(
        months.map((m) => fetchMonth(m.year, m.month)),
      );
      return results.flatMap((result) => result.items);
    },
    [fetchMonth],
  );

  const navigateToWindow = useCallback(
    async (bounds: CalendarWindowBounds) => {
      setLoadingMonth(true);
      try {
        const nextItems = await fetchWindow(bounds);
        applyWindowData(bounds, nextItems);
      } catch (error) {
        console.error('Error loading payments calendar window:', error);
      } finally {
        setLoadingMonth(false);
      }
    },
    [applyWindowData, fetchWindow],
  );

  useEffect(() => {
    let cancelled = false;
    void getCreatedMonths(context)
      .then((list) => {
        if (!cancelled) setCreatedMonths(list);
      })
      .catch(() => {
        if (!cancelled) setCreatedMonths([]);
      });
    return () => {
      cancelled = true;
    };
  }, [context]);

  const windowRef = useRef(windowBounds);
  windowRef.current = windowBounds;
  useEffect(() => {
    if (refreshNonce === 0) return;
    const bounds = windowRef.current;
    let cancelled = false;
    setLoadingMonth(true);
    void fetchWindow(bounds)
      .then((nextItems) => {
        if (cancelled) return;
        applyWindowData(bounds, nextItems);
      })
      .catch((error) => {
        console.error('Error refreshing payments calendar:', error);
      })
      .finally(() => {
        if (!cancelled) setLoadingMonth(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshNonce, fetchWindow, applyWindowData]);

  useEffect(() => {
    if (!isMobile) setSheetOpen(false);
  }, [isMobile]);

  const selectDay = useCallback(
    (ymd: string) => {
      setSelectedYmd(ymd);
      // Mobile Sheet only when the day has pending payments — empty days
      // just update selection so taps stay light.
      if (isMobile && itemsForCalendarDate(items, ymd).length > 0) {
        setSheetOpen(true);
      }
    },
    [isMobile, items],
  );

  const handleViewModeChange = useCallback(
    (nextValue: string) => {
      const nextMode = nextValue as CalendarViewMode;
      if (nextMode === viewMode || !createdMonths) return;

      const resolved = resolveInitialWindow(nextMode, todayYmd, createdMonths);
      if (!resolved) {
        // No valid week/fortnight under created-months rule — stay Mensual.
        return;
      }

      setViewMode(nextMode);
      void navigateToWindow(resolved);
    },
    [createdMonths, navigateToWindow, todayYmd, viewMode],
  );

  /**
   * Desktop xl+ (sidebar): hover tooltip.
   * Tablet / <xl under summary: agenda below the grid.
   * Mobile: bottom Sheet on day tap only when the day has pendientes.
   */
  const showInlineAgenda = !isMobile && !isXlUp;
  const showSelectionChrome = showInlineAgenda || isMobile;
  const tipOpen = canHover && isXlUp && hoverYmd != null;

  const tipAnchorRef = useMemo(
    () => ({
      get current() {
        return hoverYmd
          ? (gridRef.current?.querySelector<HTMLElement>(
              `[data-pay-cell="${hoverYmd}"]`,
            ) ?? null)
          : null;
      },
    }),
    [hoverYmd],
  );

  const navLabel = (bounds: CalendarWindowBounds | null, which: 'prev' | 'next') => {
    if (!bounds) {
      return which === 'prev'
        ? 'Periodo anterior no disponible'
        : 'Periodo siguiente no disponible';
    }
    const title = formatWindowTitle(viewMode, bounds);
    return which === 'prev' ? `Ver anterior: ${title}` : `Ver siguiente: ${title}`;
  };

  return (
    <aside
      className={cn(
        MONTHLY_LIQUID_PANEL_CLASS,
        'space-y-3 p-3 sm:space-y-4 sm:p-4',
        className,
      )}
      aria-label="Calendario de pagos"
      aria-busy={loadingMonth}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={MONTHLY_ICON_PILL_CLASS} aria-hidden>
          <CalendarDays className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold leading-tight text-foreground">
                Pagos del mes
              </h2>
              <p className="mt-0.5 text-caption text-muted-foreground">
                {periodTitle}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={!prevWindow || loadingMonth}
                aria-label={navLabel(prevWindow, 'prev')}
                onClick={() => {
                  if (prevWindow) void navigateToWindow(prevWindow);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={!nextWindow || loadingMonth}
                aria-label={navLabel(nextWindow, 'next')}
                onClick={() => {
                  if (nextWindow) void navigateToWindow(nextWindow);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <SegmentedControl
        value={viewMode}
        onValueChange={handleViewModeChange}
        ariaLabel="Vista del calendario"
        options={[...VIEW_MODE_OPTIONS]}
        className={cn(
          'w-full',
          (!createdMonths || loadingMonth) && 'pointer-events-none opacity-60',
        )}
        listClassName="w-full"
        stretch
        triggerClassName="px-2 text-caption sm:text-sm"
      />

      <div
        ref={gridRef}
        className={cn(
          'relative grid w-full grid-cols-7 gap-0.5',
          loadingMonth && 'pointer-events-none opacity-60',
        )}
        onPointerLeave={() => setHoverYmd(null)}
      >
        {WEEKDAY_LABELS.map((label, col) => {
          const hoverCol =
            hoverYmd != null
              ? (() => {
                  const [y, m, d] = hoverYmd.split('-').map(Number);
                  return (new Date(y, m - 1, d).getDay() + 6) % 7;
                })()
              : null;
          return (
            <span
              key={label}
              className={cn(
                'pb-1 text-center text-caption font-medium uppercase tracking-wide transition-colors duration-200',
                hoverCol === col ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          );
        })}

        {cells.map((cell, index) => {
          if (!cell) {
            return <span key={`empty-${index}`} className="mx-auto size-10" />;
          }

          const hot = hoverYmd === cell.ymd;
          const selected = selectedYmd === cell.ymd;
          const isToday = cell.ymd === todayYmd;
          const dim = !!hoverYmd && !hot;
          const lift = !reduce && canHover && hot ? 1.06 : 1;
          const row = Math.floor(index / 7);
          const col = index % 7;
          const selectionVisible = selected && showSelectionChrome;

          return (
            <span
              key={cell.ymd}
              className="relative mx-auto block size-10 transition-opacity duration-200"
              style={{ opacity: dim ? 0.35 : 1 }}
            >
              <motion.button
                type="button"
                data-pay-cell={cell.ymd}
                aria-describedby={hot && canHover ? tooltipId : undefined}
                aria-label={`${formatDayHeading(cell.ymd)}${
                  cell.count > 0
                    ? `, ${cell.count} pendiente${cell.count === 1 ? '' : 's'}`
                    : ''
                }`}
                aria-pressed={selectionVisible}
                className="absolute -inset-px block rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onPointerEnter={() => {
                  if (canHover && isXlUp) setHoverYmd(cell.ymd);
                }}
                onFocus={() => {
                  if (canHover && isXlUp) setHoverYmd(cell.ymd);
                }}
                onBlur={() => setHoverYmd(null)}
                onClick={() => selectDay(cell.ymd)}
                whileTap={
                  reduce ? undefined : { scale: 0.94, transition: SPRING_PRESS }
                }
              >
                <motion.span
                  className={cn(
                    'pointer-events-none absolute inset-px grid place-items-center rounded-[3px]',
                    'font-mono text-caption font-medium tabular-nums leading-none',
                    selectionVisible && 'font-semibold text-foreground',
                  )}
                  style={{
                    background:
                      pendingTint(
                        cell.count > 0
                          ? Math.max(1, (cell.count / maxPending) * 4)
                          : 0,
                        hot,
                      ) ??
                      (selectionVisible
                        ? 'color-mix(in srgb, var(--foreground) 6%, transparent)'
                        : undefined),
                    boxShadow: selectionVisible
                      ? 'inset 0 0 0 1.5px color-mix(in srgb, var(--foreground) 22%, transparent)'
                      : 'none',
                    transition: 'background 150ms, box-shadow 150ms',
                  }}
                  initial={reduce ? false : { opacity: 0, scale: 0.72 }}
                  animate={{
                    opacity: 1,
                    scale: lift,
                    transition: reduce
                      ? { duration: 0 }
                      : { ...SPRING_PRESS, delay: (row + col) * 0.012 },
                  }}
                >
                  <AnimatePresence>
                    {hot && canHover && isXlUp ? (
                      <motion.span
                        className="pointer-events-none absolute inset-0 rounded-[inherit] border"
                        style={{ borderColor: PENDING_CELL_COLOR }}
                        initial={reduce ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12, ease: EASE_OUT }}
                      />
                    ) : null}
                  </AnimatePresence>
                  <span
                    className={cn('relative z-10', isToday && 'font-black')}
                    style={
                      isToday ? { color: TODAY_NUMBER_COLOR } : undefined
                    }
                  >
                    {cell.day}
                  </span>
                </motion.span>
              </motion.button>
            </span>
          );
        })}

        {canHover && isXlUp ? (
          <Tooltip
            key={hoverYmd ?? 'closed'}
            id={tooltipId}
            open={tipOpen}
            onOpenChange={(open) => {
              if (!open) setHoverYmd(null);
            }}
            anchorRef={tipAnchorRef}
            side="top"
            className="flex max-w-[16rem] flex-col gap-1"
            content={
              hoverYmd ? (
                <>
                  <span className="text-muted-foreground">
                    {formatDayHeading(hoverYmd)}
                  </span>
                  {hoverItems.length === 0 ? (
                    <span className="text-foreground">Sin pagos pendientes</span>
                  ) : (
                    <>
                      <span className="font-mono tabular-nums text-foreground">
                        {formatCurrency(hoverTotal)}
                        <span className="ml-1 text-muted-foreground">
                          · {hoverItems.length} pendiente
                          {hoverItems.length === 1 ? '' : 's'}
                        </span>
                      </span>
                      <ul className="flex flex-col gap-0.5 text-caption text-muted-foreground">
                        {hoverItems.slice(0, 3).map((item) => (
                          <li
                            key={`${item.type}-${item.sourceId}-${item.date}`}
                            className="truncate"
                          >
                            - {item.name}
                          </li>
                        ))}
                        {hoverItems.length > 3 ? (
                          <li className="truncate">- más...</li>
                        ) : null}
                      </ul>
                    </>
                  )}
                </>
              ) : null
            }
          />
        ) : null}
      </div>

      {showInlineAgenda ? (
        <div className="space-y-2 border-t border-border/50 pt-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-caption font-semibold text-foreground">
              {formatDayHeading(selectedYmd)}
            </h3>
            {dayItems.some((item) => item.amount != null) ? (
              <span className="text-caption text-muted-foreground tabular-nums">
                {formatCurrency(dayTotal)}
              </span>
            ) : null}
          </div>
          <AgendaList items={dayItems} />
        </div>
      ) : null}

      <ResponsiveOverlay
        open={sheetOpen && isMobile}
        onOpenChange={setSheetOpen}
        title={formatDayHeading(selectedYmd)}
        description="Pagos pendientes del día seleccionado."
        dismissLabel="Cerrar"
      >
        <div className="space-y-3 px-1 pb-2">
          {dayItems.some((item) => item.amount != null) ? (
            <p className="text-caption text-muted-foreground tabular-nums">
              Total {formatCurrency(dayTotal)}
            </p>
          ) : null}
          <AgendaList items={dayItems} emptyClassName="py-6" />
        </div>
      </ResponsiveOverlay>
    </aside>
  );
};
