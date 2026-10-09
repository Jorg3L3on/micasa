'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Goal,
  HandCoins,
  Receipt,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { Money } from '@/components/money';
import {
  AURA_TAB_INDICATOR_CLASS,
  GLASS_TAB_ACTIVE_LABEL_CLASS,
  MONTHLY_ICON_PILL_CLASS,
  MONTHLY_LIQUID_PANEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import { EASE_OUT, SPRING_PRESS } from '@/components/motion/ease';
import { Tooltip } from '@/components/motion/tooltip';
import {
  AmountDisplayRow,
  OVERLAY_GROUPED_CARD_CLASS,
  OverlayHint,
  OverlayListRow,
} from '@/components/overlay/overlay-form';
import { ResponsiveOverlay } from '@/components/overlay/responsive-overlay';
import { SegmentedControl } from '@/components/segmented-control';
import { Button } from '@/components/ui/button';
import {
  Tooltip as UiTooltip,
  TooltipContent as UiTooltipContent,
  TooltipTrigger as UiTooltipTrigger,
} from '@/components/ui/tooltip';
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
  isWindowFullyCreated,
  monthBounds,
  neighborWindow,
  pendingDatesFromCalendarItems,
  resolveInitialWindow,
  type CalendarViewMode,
  type CalendarWindowBounds,
  weekBoundsContaining,
  windowMonths,
  itemsForCalendarDate,
} from '@/lib/finance/payments-calendar';
import { getDaysInCalendarMonth } from '@/lib/fortnight-calendar';
import { useHoverCapable } from '@/lib/hooks/use-hover-capable';
import {
  AURA_TONE_HEX,
  getDueRowTone,
  hexWithAlpha,
} from '@/lib/ui/aura-palette';
import { cn, formatCurrency } from '@/lib/utils';
import type {
  PaymentsCalendarItem,
  PaymentsCalendarItemType,
  PaymentsCalendarResult,
} from '@/types/payments-calendar';

const MAX_PENDING_DOTS = 3;

type DayUrgency = 'overdue' | 'soon' | 'later';

const DAY_URGENCY_LEGEND: Array<{ urgency: DayUrgency; label: string }> = [
  { urgency: 'overdue', label: 'Vencido' },
  { urgency: 'soon', label: 'Próximos 7 días' },
  { urgency: 'later', label: 'Más adelante' },
];

const ymdToUtcMs = (ymd: string): number => {
  const [y, m, d] = ymd.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const daysBetweenYmd = (fromYmd: string, toYmd: string): number =>
  Math.round((ymdToUtcMs(toYmd) - ymdToUtcMs(fromYmd)) / 86_400_000);

const getDayUrgency = (ymd: string, todayYmd: string): DayUrgency => {
  const tone = getDueRowTone('pending', daysBetweenYmd(todayYmd, ymd));
  if (tone === 'destructive') return 'overdue';
  if (tone === 'amber') return 'soon';
  return 'later';
};

/** Tinted hex for urgent days; null keeps the neutral glass tile. */
const URGENCY_HEX: Record<DayUrgency, string | null> = {
  overdue: AURA_TONE_HEX.destructive,
  soon: AURA_TONE_HEX.amber,
  later: null,
};

const GLASS_DOT_COLOR = 'color-mix(in srgb, var(--foreground) 55%, transparent)';

const GLASS_TOP_HIGHLIGHT =
  'inset 0 1px 0 color-mix(in srgb, white 16%, transparent)';

const glassFill = (hot: boolean): string => {
  const top = hot ? 14 : 9;
  const bottom = hot ? 6 : 3;
  return `linear-gradient(180deg, color-mix(in srgb, var(--foreground) ${top}%, transparent), color-mix(in srgb, var(--foreground) ${bottom}%, transparent))`;
};

/**
 * Every pending day is a neutral glass tile; urgency only tints a bottom glow
 * and the dots. Low-alpha amber/red fills turn muddy brown on navy.
 */
const pendingCellStyle = (
  urgency: DayUrgency,
  hot: boolean,
): { background: string; boxShadow: string } => {
  const hex = URGENCY_HEX[urgency];
  const edge = hot ? 28 : 16;
  const glow = hex
    ? `radial-gradient(120% 90% at 50% 120%, ${hexWithAlpha(hex, hot ? 0.5 : 0.34)}, transparent 70%), `
    : '';
  return {
    background: `${glow}${glassFill(hot)}`,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, var(--foreground) ${edge}%, transparent), ${GLASS_TOP_HIGHLIGHT}`,
  };
};

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
  return `${ordinal} quincena · ${formatWeekTitle(bounds)}`;
};

const CALENDAR_HEADING_BY_MODE: Record<CalendarViewMode, string> = {
  week: 'Pagos de la semana',
  fortnight: 'Pagos de la quincena',
  month: 'Pagos del mes',
};

const CURRENT_WINDOW_LABEL_BY_MODE: Record<CalendarViewMode, string> = {
  week: 'Ir a la semana actual',
  fortnight: 'Ir a la quincena actual',
  month: 'Ir al mes actual',
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

const CALENDAR_ITEM_ICON: Record<PaymentsCalendarItemType, LucideIcon> = {
  expense: Receipt,
  loan: HandCoins,
  revolving: CreditCard,
  msi: CreditCard,
  template: RefreshCw,
};

const pluralDays = (days: number): string =>
  `${days} ${days === 1 ? 'día' : 'días'}`;

const dayStatusLabel = (ymd: string, todayYmd: string): string => {
  const daysLeft = daysBetweenYmd(todayYmd, ymd);
  if (daysLeft < 0) return `Vencido · hace ${pluralDays(-daysLeft)}`;
  if (daysLeft === 0) return 'Vence hoy';
  return `En ${pluralDays(daysLeft)}`;
};

/** Largest known amounts first; unknown amounts last. */
const sortDayItems = (items: PaymentsCalendarItem[]): PaymentsCalendarItem[] =>
  [...items].sort((a, b) => {
    if (a.amount == null || b.amount == null) {
      return a.amount == null ? (b.amount == null ? 0 : 1) : -1;
    }
    return b.amount - a.amount;
  });

const DaySheetBody = ({
  ymd,
  items,
  todayYmd,
}: {
  ymd: string;
  items: PaymentsCalendarItem[];
  todayYmd: string;
}) => {
  const urgency = getDayUrgency(ymd, todayYmd);
  const sortedItems = sortDayItems(items);
  const total = items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const hasUnknownAmount = items.some((item) => item.amount == null);

  return (
    <div className="flex flex-col gap-3">
      <OverlayHint role="status" className="flex items-center gap-1.5">
        <span
          className="block size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: URGENCY_HEX[urgency] ?? GLASS_DOT_COLOR }}
          aria-hidden
        />
        {dayStatusLabel(ymd, todayYmd)} · {items.length} pendiente
        {items.length === 1 ? '' : 's'}
      </OverlayHint>

      <div className={OVERLAY_GROUPED_CARD_CLASS}>
        <AmountDisplayRow label="Total del día" value={total} />
        {sortedItems.map((item) => {
          const Icon = CALENDAR_ITEM_ICON[item.type];
          return (
            <OverlayListRow
              key={`${item.type}-${item.sourceId}-${item.date}`}
              icon={<Icon />}
              title={item.name}
              subtitle={item.typeLabel}
              trailing={
                item.amount != null ? (
                  <Money value={item.amount} size="row" tone="neutral" />
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Sin monto
                  </span>
                )
              }
            />
          );
        })}
      </div>

      {hasUnknownAmount ? (
        <OverlayHint>
          Algunos montos aún no se conocen y no suman al total.
        </OverlayHint>
      ) : null}
    </div>
  );
};

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
  const reduce = useReducedMotion();
  /**
   * Hover-capable md+: tooltip on hover.
   * Mobile or touch-only: Sheet on day tap only when the day has pendientes.
   */
  const showHoverTip = canHover && !isMobile;
  const opensDaySheet = !showHoverTip;
  const tooltipId = useId();
  const gridRef = useRef<HTMLDivElement>(null);

  const [initialWeek] = useState<CalendarWindowBounds>(() => {
    const viewedMonth = monthBounds(year, month);
    const todayInViewedMonth =
      todayYmd >= viewedMonth.startYmd && todayYmd <= viewedMonth.endYmd;
    return weekBoundsContaining(
      todayInViewedMonth ? todayYmd : viewedMonth.startYmd,
    );
  });
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [windowBounds, setWindowBounds] =
    useState<CalendarWindowBounds>(initialWeek);
  const [items, setItems] = useState(initialItems);
  const [createdMonths, setCreatedMonths] = useState<CreatedMonth[] | null>(
    null,
  );
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [loadingBounds, setLoadingBounds] =
    useState<CalendarWindowBounds | null>(null);
  const [hoverYmd, setHoverYmd] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [selectedYmd, setSelectedYmd] = useState(() =>
    defaultSelectedDayInWindow({
      startYmd: initialWeek.startYmd,
      endYmd: initialWeek.endYmd,
      todayYmd,
      pendingDates: pendingDatesFromCalendarItems(initialItems),
    }),
  );

  const cells = useMemo(
    () => buildWindowCells(viewMode, windowBounds, items),
    [viewMode, windowBounds, items],
  );

  const dayItems = useMemo(
    () => itemsForCalendarDate(items, selectedYmd),
    [items, selectedYmd],
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
    () => formatWindowTitle(viewMode, loadingBounds ?? windowBounds),
    [viewMode, loadingBounds, windowBounds],
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
      setLoadingBounds(bounds);
      try {
        const nextItems = await fetchWindow(bounds);
        applyWindowData(bounds, nextItems);
      } catch (error) {
        console.error('Error loading payments calendar window:', error);
      } finally {
        setLoadingMonth(false);
        setLoadingBounds(null);
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

  const initialWindowResolvedRef = useRef(false);
  useEffect(() => {
    if (!createdMonths || initialWindowResolvedRef.current) return;
    initialWindowResolvedRef.current = true;

    if (
      !isWindowFullyCreated(
        initialWeek.startYmd,
        initialWeek.endYmd,
        createdMonths,
      )
    ) {
      setViewMode('month');
      applyWindowData(monthBounds(year, month), initialItems);
      return;
    }

    if (windowMonths(initialWeek.startYmd, initialWeek.endYmd).length > 1) {
      void navigateToWindow(initialWeek);
    }
  }, [
    applyWindowData,
    createdMonths,
    initialItems,
    initialWeek,
    month,
    navigateToWindow,
    year,
  ]);

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
    if (!opensDaySheet) setSheetOpen(false);
  }, [opensDaySheet]);

  const selectDay = useCallback(
    (ymd: string) => {
      setSelectedYmd(ymd);
      // Sheet only when the day has pending payments — empty days
      // just update selection so taps stay light.
      if (opensDaySheet && itemsForCalendarDate(items, ymd).length > 0) {
        setSheetOpen(true);
      }
    },
    [opensDaySheet, items],
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

  const tipOpen = showHoverTip && hoverYmd != null;

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

  const currentWindow = useMemo(
    () =>
      createdMonths
        ? resolveInitialWindow(viewMode, todayYmd, createdMonths)
        : null,
    [createdMonths, todayYmd, viewMode],
  );
  const isOnCurrentWindow =
    currentWindow != null &&
    currentWindow.startYmd === windowBounds.startYmd &&
    currentWindow.endYmd === windowBounds.endYmd;

  const handleGoToCurrentWindow = () => {
    if (currentWindow) void navigateToWindow(currentWindow);
  };

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
                {CALENDAR_HEADING_BY_MODE[viewMode]}
              </h2>
              <p className="mt-0.5 text-caption text-muted-foreground">
                {periodTitle}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {currentWindow && !isOnCurrentWindow ? (
                <UiTooltip>
                  <UiTooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      disabled={loadingMonth}
                      aria-label={CURRENT_WINDOW_LABEL_BY_MODE[viewMode]}
                      onClick={handleGoToCurrentWindow}
                    >
                      <Goal className="h-4 w-4" aria-hidden />
                    </Button>
                  </UiTooltipTrigger>
                  <UiTooltipContent side="bottom" sideOffset={4}>
                    {CURRENT_WINDOW_LABEL_BY_MODE[viewMode]}
                  </UiTooltipContent>
                </UiTooltip>
              ) : null}
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
        variant="segment"
        className={cn(
          'w-full',
          (!createdMonths || loadingMonth) && 'pointer-events-none opacity-60',
        )}
        listClassName="w-full"
        stretch
        triggerClassName="px-2"
        indicatorClassName={AURA_TAB_INDICATOR_CLASS}
        activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
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
          const selectionVisible = selected && opensDaySheet;
          const hasPending = cell.count > 0;
          const urgency = getDayUrgency(cell.ymd, todayYmd);
          const pendingStyle = hasPending
            ? pendingCellStyle(urgency, hot)
            : null;
          const selectionRing =
            'inset 0 0 0 1.5px color-mix(in srgb, var(--foreground) 22%, transparent)';
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
                className="absolute -inset-px block rounded-[8px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onPointerEnter={() => {
                  if (showHoverTip) setHoverYmd(cell.ymd);
                }}
                onFocus={() => {
                  if (showHoverTip) setHoverYmd(cell.ymd);
                }}
                onBlur={() => setHoverYmd(null)}
                onClick={() => selectDay(cell.ymd)}
                whileTap={
                  reduce ? undefined : { scale: 0.94, transition: SPRING_PRESS }
                }
              >
                <motion.span
                  className={cn(
                    'pointer-events-none absolute inset-px grid place-items-center rounded-[7px]',
                    'font-mono text-caption font-medium tabular-nums leading-none',
                    selectionVisible && 'font-semibold text-foreground',
                  )}
                  style={{
                    background:
                      pendingStyle?.background ??
                      (selectionVisible
                        ? 'color-mix(in srgb, var(--foreground) 6%, transparent)'
                        : undefined),
                    boxShadow:
                      [
                        pendingStyle?.boxShadow,
                        selectionVisible ? selectionRing : null,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'none',
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
                    {hot && showHoverTip ? (
                      <motion.span
                        className="pointer-events-none absolute inset-0 rounded-[inherit] border"
                        style={{
                          borderColor:
                            'color-mix(in srgb, var(--foreground) 40%, transparent)',
                        }}
                        initial={reduce ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12, ease: EASE_OUT }}
                      />
                    ) : null}
                  </AnimatePresence>
                  <span
                    className={cn(
                      'relative z-10',
                      hasPending && 'font-semibold text-foreground',
                      isToday &&
                        'grid size-6 place-items-center rounded-full bg-primary font-bold text-white shadow-[0_0_10px_-2px_var(--primary)]',
                    )}
                  >
                    {cell.day}
                  </span>
                  {hasPending ? (
                    <span
                      className="absolute inset-x-0 bottom-1 z-10 flex justify-center gap-0.5"
                      aria-hidden
                    >
                      {Array.from({
                        length: Math.min(cell.count, MAX_PENDING_DOTS),
                      }).map((_, dotIndex) => (
                        <span
                          key={dotIndex}
                          className="block size-[3px] rounded-full"
                          style={{
                            backgroundColor:
                              URGENCY_HEX[urgency] ?? GLASS_DOT_COLOR,
                          }}
                        />
                      ))}
                    </span>
                  ) : null}
                </motion.span>
              </motion.button>
            </span>
          );
        })}

        {showHoverTip ? (
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

      <ul
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-caption text-muted-foreground"
        aria-label="Leyenda del calendario"
      >
        {DAY_URGENCY_LEGEND.map(({ urgency, label }) => (
          <li key={urgency} className="flex items-center gap-1.5">
            <span
              className="block size-1.5 rounded-full"
              style={{
                backgroundColor: URGENCY_HEX[urgency] ?? GLASS_DOT_COLOR,
              }}
              aria-hidden
            />
            {label}
          </li>
        ))}
      </ul>

      <ResponsiveOverlay
        open={sheetOpen && opensDaySheet}
        onOpenChange={setSheetOpen}
        title={formatDayHeading(selectedYmd)}
        description="Pagos pendientes del día seleccionado."
        dismissLabel="Cerrar"
      >
        <DaySheetBody ymd={selectedYmd} items={dayItems} todayYmd={todayYmd} />
      </ResponsiveOverlay>
    </aside>
  );
};
