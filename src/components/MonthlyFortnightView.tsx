'use client';

import { useCallback, useEffect, useState } from 'react';
import FortnightColumn from '@/components/FortnightColumn';
import { Button } from '@/components/ui/button';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn, formatCurrency } from '@/lib/utils';
import type { ExpenseTableDensity } from '@/components/ExpenseTable';
import type {
  DuePaymentItem,
  PlannerCardChargesSummary,
  PlannerCardStatementDueSummary,
  PlannerOrphanCardPaymentsSummary,
  TransactionRow,
} from '@/types/catalog';
import { SlidersHorizontal } from 'lucide-react';

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

  const handleLayoutRadio = useCallback((value: string) => {
    if (value === 'single') {
      setLayout('single');
      persistLayout('single');
    } else if (value === 'both') {
      setLayout('both');
      persistLayout('both');
    }
  }, []);

  const handlePeriodChange = useCallback((value: string) => {
    if (value !== 'FIRST' && value !== 'SECOND') return;
    setPeriod(value);
    persistPeriod(value);
  }, []);

  const handleSummaryChecked = useCallback((checked: boolean) => {
    setSummaryVisible(checked);
    persistSummaryVisible(checked);
  }, []);

  const handleTableDensityChange = useCallback((value: string) => {
    if (value !== 'comfortable' && value !== 'compact') return;
    setTableDensity(value);
    persistTableDensity(value);
  }, []);

  const handleShowSummaryFromColumn = useCallback(() => {
    setSummaryVisible(true);
    persistSummaryVisible(true);
  }, []);

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

  const segmentBtn = (active: boolean) =>
    cn(
      'rounded-md px-3 py-1 text-xs font-semibold transition-all duration-150',
      active
        ? 'bg-primary/15 text-primary shadow-sm ring-1 ring-inset ring-primary/20'
        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    );

  return (
    <div
      className={cn(
        'space-y-3',
        layout === 'single' && 'mx-auto w-full max-w-4xl xl:max-w-5xl',
      )}
    >
      <div
        className="flex items-center justify-end gap-2"
        role="region"
        aria-label="Controles de vista de planificación"
      >
        {/* Layout toggle: Una | Ambas */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border/60 p-0.5">
          <button
            type="button"
            onClick={() => handleLayoutRadio('single')}
            className={segmentBtn(layout === 'single')}
            aria-pressed={layout === 'single'}
            aria-label="Ver una quincena"
          >
            Una
          </button>
          <button
            type="button"
            onClick={() => handleLayoutRadio('both')}
            className={segmentBtn(layout === 'both')}
            aria-pressed={layout === 'both'}
            aria-label="Ver ambas quincenas"
          >
            Ambas
          </button>
        </div>

        {/* Period selector — only visible in single mode */}
        {layout === 'single' && (
          <div className="flex items-center gap-0.5 rounded-lg border border-border/60 p-0.5">
            <button
              type="button"
              onClick={() => handlePeriodChange('FIRST')}
              className={segmentBtn(period === 'FIRST')}
              aria-pressed={period === 'FIRST'}
              aria-label={`Primera quincena: ${first.label}`}
              title={first.label}
            >
              1ª
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('SECOND')}
              className={segmentBtn(period === 'SECOND')}
              aria-pressed={period === 'SECOND'}
              aria-label={`Segunda quincena: ${second.label}`}
              title={second.label}
            >
              2ª
            </button>
          </div>
        )}

        {/* Secondary settings: summary visibility + table density */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Opciones adicionales de vista"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
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

      <div
        className={cn(
          'grid gap-6',
          layout === 'both' ? 'grid-cols-1 gap-10 lg:grid-cols-2' : 'grid-cols-1',
        )}
      >
        {showFirst ? (
          <div className="flex flex-col gap-3">
            {layout === 'both' && (
              <div className="flex items-center justify-between rounded-lg border border-primary/15 bg-primary/5 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-inset ring-primary/25">
                    1ª
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground">
                    {first.label}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-xs font-medium tabular-nums text-muted-foreground">
                  {formatCurrency(first.summary.totalIncome)}
                </span>
              </div>
            )}
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
          </div>
        ) : null}
        {showSecond ? (
          <div className="flex flex-col gap-3">
            {layout === 'both' && (
              <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted/70 text-xs font-bold text-muted-foreground ring-1 ring-inset ring-border/60">
                    2ª
                  </span>
                  <span className="truncate text-sm font-semibold text-foreground">
                    {second.label}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-xs font-medium tabular-nums text-muted-foreground">
                  {formatCurrency(second.summary.totalIncome)}
                </span>
              </div>
            )}
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
          </div>
        ) : null}
      </div>
    </div>
  );
}
