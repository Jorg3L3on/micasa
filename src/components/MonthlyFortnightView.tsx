'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import FortnightColumn from '@/components/FortnightColumn';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ExpenseTableDensity } from '@/components/ExpenseTable';
import type {
  DuePaymentItem,
  PlannerCardChargesSummary,
  PlannerCardStatementDueSummary,
  PlannerOrphanCardPaymentsSummary,
  TransactionRow,
} from '@/types/catalog';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

const LAYOUT_STORAGE_KEY = 'micasa.planificacion.layout';
const PERIOD_STORAGE_KEY = 'micasa.planificacion.period';
const SUMMARY_VISIBLE_STORAGE_KEY = 'micasa.planificacion.summaryVisible';
/** Vista de tabla: filas más altas (cómoda) o más densas (compacta). */
const TABLE_DENSITY_STORAGE_KEY = 'micasa.planificacion.tableDensity';

type LayoutMode = 'single' | 'both';
type FortnightPeriod = 'FIRST' | 'SECOND';

type FortnightSummary = {
  totalIncome: number;
  totalExpense: number;
  totalPaid: number;
  totalUnpaid: number;
  balance: number;
  userIncome?: Array<{
    fortnightId: number;
    userIncome: Array<{ userId: number; userName: string; income: number }>;
  }>;
  incomeItems?: Array<{
    fortnightId: number;
    id: number;
    amount: number;
    source: string | null;
    userName: string | null;
    templateName: string | null;
  }>;
  planningExpenseCount?: number;
  planningPaidExpenseCount?: number;
  planningUnpaidExpenseCount?: number;
  cardCharges?: PlannerCardChargesSummary | null;
  planningOrphanCardPayments?: PlannerOrphanCardPaymentsSummary | null;
  planningCardStatementDue?: PlannerCardStatementDueSummary | null;
};

type FortnightBundle = {
  label: string;
  transactions: TransactionRow[];
  summary: FortnightSummary;
  fortnightId: number;
  /** Card payment reminders for this quincena (current month only). */
  cardDueItems?: DuePaymentItem[];
};

export type MonthlyFortnightViewProps = {
  ownerKey: string;
  year: number;
  month: number;
  suggestedPeriod: FortnightPeriod;
  first: FortnightBundle;
  second: FortnightBundle;
};

const readStoredLayout = (): LayoutMode | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (raw === 'single' || raw === 'both') return raw;
  } catch {
    return null;
  }
  return null;
};

const readStoredPeriod = (): FortnightPeriod | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PERIOD_STORAGE_KEY);
    if (raw === 'FIRST' || raw === 'SECOND') return raw;
  } catch {
    return null;
  }
  return null;
};

const persistLayout = (layout: LayoutMode) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
  } catch {
    /* ignore */
  }
};

const persistPeriod = (period: FortnightPeriod) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PERIOD_STORAGE_KEY, period);
  } catch {
    /* ignore */
  }
};

const readStoredSummaryVisible = (): boolean | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SUMMARY_VISIBLE_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  } catch {
    return null;
  }
  return null;
};

const persistSummaryVisible = (visible: boolean) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SUMMARY_VISIBLE_STORAGE_KEY, visible ? 'true' : 'false');
  } catch {
    /* ignore */
  }
};

const readStoredTableDensity = (): ExpenseTableDensity | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TABLE_DENSITY_STORAGE_KEY);
    if (raw === 'comfortable' || raw === 'compact') return raw;
  } catch {
    return null;
  }
  return null;
};

const persistTableDensity = (density: ExpenseTableDensity) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TABLE_DENSITY_STORAGE_KEY, density);
  } catch {
    /* ignore */
  }
};

export default function MonthlyFortnightView({
  ownerKey,
  year,
  month,
  suggestedPeriod,
  first,
  second,
}: MonthlyFortnightViewProps) {
  const [prefsReady, setPrefsReady] = useState(false);
  const [layout, setLayout] = useState<LayoutMode>('single');
  const [period, setPeriod] = useState<FortnightPeriod>(suggestedPeriod);
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [tableDensity, setTableDensity] =
    useState<ExpenseTableDensity>('comfortable');
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const storedLayout = readStoredLayout();
    const storedPeriod = readStoredPeriod();
    const storedSummary = readStoredSummaryVisible();
    const storedDensity = readStoredTableDensity();
    if (storedLayout) {
      setLayout(storedLayout);
    }
    if (storedPeriod) {
      setPeriod(storedPeriod);
    }
    if (storedSummary !== null) {
      setSummaryVisible(storedSummary);
    }
    if (storedDensity) {
      setTableDensity(storedDensity);
    }
    setPrefsReady(true);
  }, []);

  const closeSheetAfterChange = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const handleLayoutRadio = useCallback(
    (value: string, fromSheet?: boolean) => {
      if (value === 'single') {
        setLayout('single');
        persistLayout('single');
        if (fromSheet) closeSheetAfterChange();
        return;
      }
      if (value === 'both') {
        setLayout('both');
        persistLayout('both');
        if (fromSheet) closeSheetAfterChange();
      }
    },
    [closeSheetAfterChange],
  );

  const handlePeriodChange = useCallback(
    (value: string, fromSheet?: boolean) => {
      if (value !== 'FIRST' && value !== 'SECOND') return;
      setPeriod(value);
      persistPeriod(value);
      if (fromSheet) closeSheetAfterChange();
    },
    [closeSheetAfterChange],
  );

  const handleSummaryChecked = useCallback(
    (checked: boolean, fromSheet?: boolean) => {
      setSummaryVisible(checked);
      persistSummaryVisible(checked);
      if (fromSheet) closeSheetAfterChange();
    },
    [closeSheetAfterChange],
  );

  const handleTableDensityChange = useCallback(
    (value: string, fromSheet?: boolean) => {
      if (value !== 'comfortable' && value !== 'compact') return;
      setTableDensity(value);
      persistTableDensity(value);
      if (fromSheet) closeSheetAfterChange();
    },
    [closeSheetAfterChange],
  );

  const handleShowSummaryFromColumn = useCallback(() => {
    setSummaryVisible(true);
    persistSummaryVisible(true);
  }, []);

  const vistaChip = useMemo(() => {
    if (layout === 'both') return 'Ambas';
    return period === 'FIRST' ? 'Una · 1ª' : 'Una · 2ª';
  }, [layout, period]);

  const showFirst = layout === 'both' || period === 'FIRST';
  const showSecond = layout === 'both' || period === 'SECOND';

  if (!prefsReady) {
    return (
      <div
        className="space-y-3"
        role="status"
        aria-busy="true"
        aria-label="Cargando preferencias de vista"
      >
        <div className="flex justify-start sm:justify-end">
          <Skeleton className="h-8 w-40 rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-lg border border-border/60" />
          <Skeleton className="h-52 w-full rounded-lg border border-border/60" />
        </div>
      </div>
    );
  }

  const sheetOptionClass = (active: boolean) =>
    cn(
      'flex min-h-11 w-full items-center rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors',
      active
        ? 'border-primary/40 bg-primary/5 text-foreground'
        : 'border-border/60 bg-card text-foreground hover:bg-muted/50',
    );

  return (
    <div
      className={cn(
        'space-y-3',
        layout === 'single' && 'mx-auto w-full max-w-4xl xl:max-w-5xl',
      )}
    >
      <div
        className={cn(
          'flex',
          layout === 'single' ? 'justify-start' : 'justify-end',
        )}
        role="region"
        aria-label="Controles de vista de planificación"
      >
        <Button
          type="button"
          variant="ghost"
          className={cn(
            'h-8 gap-1.5 rounded-lg px-2 text-muted-foreground sm:hidden',
            'hover:bg-muted/60 hover:text-foreground',
          )}
          aria-haspopup="dialog"
          aria-label={`Vista de planificación: ${vistaChip}. Abrir opciones.`}
          onClick={() => setSheetOpen(true)}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="text-xs font-medium">Vista</span>
          <span className="max-w-[120px] truncate text-xs text-muted-foreground">
            {vistaChip}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        </Button>

        <div className="hidden sm:block">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  'h-8 gap-1.5 rounded-lg px-2 text-muted-foreground',
                  'hover:bg-muted/60 hover:text-foreground',
                )}
                aria-haspopup="menu"
                aria-label={`Vista de planificación: ${vistaChip}. Abrir opciones.`}
              >
                <SlidersHorizontal
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden
                />
                <span className="text-xs font-medium sm:text-sm">Vista</span>
                <span className="max-w-[120px] truncate text-xs text-muted-foreground sm:max-w-[200px]">
                  {vistaChip}
                </span>
                <ChevronDown
                  className="h-3.5 w-3.5 shrink-0 opacity-60"
                  aria-hidden
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="min-w-56"
              aria-label="Opciones de vista de planificación"
            >
              <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Disposición
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={layout}
                onValueChange={handleLayoutRadio}
              >
                <DropdownMenuRadioItem value="single">
                  Una quincena
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="both">
                  Ambas quincenas
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              {layout === 'single' ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quincena visible
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={period}
                    onValueChange={handlePeriodChange}
                  >
                    <DropdownMenuRadioItem
                      value="FIRST"
                      title={first.label}
                      className="max-w-[min(100vw-2rem,18rem)]"
                    >
                      <span className="truncate">1ª — {first.label}</span>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="SECOND"
                      title={second.label}
                      className="max-w-[min(100vw-2rem,18rem)]"
                    >
                      <span className="truncate">2ª — {second.label}</span>
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </>
              ) : null}

              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={summaryVisible}
                onCheckedChange={handleSummaryChecked}
              >
                Mostrar resumen
              </DropdownMenuCheckboxItem>

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Densidad de tabla
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={tableDensity}
                onValueChange={handleTableDensityChange}
              >
                <DropdownMenuRadioItem value="comfortable">
                  Cómoda
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="compact">
                  Compacta
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[88vh] overflow-y-auto rounded-t-xl px-4 pb-6 pt-2 sm:hidden"
          showCloseButton
        >
          <SheetHeader className="pb-2 text-left">
            <SheetTitle className="text-base">Vista de planificación</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-5 pt-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Disposición
              </p>
              <div
                className="flex flex-col gap-2"
                role="radiogroup"
                aria-label="Disposición de quincenas"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={layout === 'single'}
                  className={sheetOptionClass(layout === 'single')}
                  onClick={() => handleLayoutRadio('single', true)}
                >
                  Una quincena
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={layout === 'both'}
                  className={sheetOptionClass(layout === 'both')}
                  onClick={() => handleLayoutRadio('both', true)}
                >
                  Ambas quincenas
                </button>
              </div>
            </div>

            {layout === 'single' ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Quincena visible
                </p>
                <div
                  className="flex flex-col gap-2"
                  role="radiogroup"
                  aria-label="Quincena visible"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={period === 'FIRST'}
                    className={sheetOptionClass(period === 'FIRST')}
                    onClick={() => handlePeriodChange('FIRST', true)}
                  >
                    <span className="truncate">1ª — {first.label}</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={period === 'SECOND'}
                    className={sheetOptionClass(period === 'SECOND')}
                    onClick={() => handlePeriodChange('SECOND', true)}
                  >
                    <span className="truncate">2ª — {second.label}</span>
                  </button>
                </div>
              </div>
            ) : null}

            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5">
              <Checkbox
                checked={summaryVisible}
                onCheckedChange={(c) => handleSummaryChecked(c === true, true)}
                aria-label="Mostrar resumen"
              />
              <span className="text-sm font-medium">Mostrar resumen</span>
            </label>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Densidad de tabla
              </p>
              <div
                className="flex flex-col gap-2"
                role="radiogroup"
                aria-label="Densidad de tabla"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={tableDensity === 'comfortable'}
                  className={sheetOptionClass(tableDensity === 'comfortable')}
                  onClick={() => handleTableDensityChange('comfortable', true)}
                >
                  Cómoda
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={tableDensity === 'compact'}
                  className={sheetOptionClass(tableDensity === 'compact')}
                  onClick={() => handleTableDensityChange('compact', true)}
                >
                  Compacta
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          'grid gap-6',
          layout === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {showFirst ? (
          <FortnightColumn
            key={`${ownerKey}-${year}-${month}-FIRST`}
            label={first.label}
            transactions={first.transactions}
            summary={first.summary}
            fortnightId={first.fortnightId}
            year={year}
            month={month}
            period="FIRST"
            showSummaryCard={summaryVisible}
            onShowSummaryCard={handleShowSummaryFromColumn}
            tableDensity={tableDensity}
            cardDueItems={first.cardDueItems}
          />
        ) : null}
        {showSecond ? (
          <FortnightColumn
            key={`${ownerKey}-${year}-${month}-SECOND`}
            label={second.label}
            transactions={second.transactions}
            summary={second.summary}
            fortnightId={second.fortnightId}
            year={year}
            month={month}
            period="SECOND"
            showSummaryCard={summaryVisible}
            onShowSummaryCard={handleShowSummaryFromColumn}
            tableDensity={tableDensity}
            cardDueItems={second.cardDueItems}
          />
        ) : null}
      </div>
    </div>
  );
}
