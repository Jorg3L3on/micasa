'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';
import type { TransactionRow } from '@/types/catalog';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

const LAYOUT_STORAGE_KEY = 'micasa.planificacion.layout';
const PERIOD_STORAGE_KEY = 'micasa.planificacion.period';
const SUMMARY_VISIBLE_STORAGE_KEY = 'micasa.planificacion.summaryVisible';

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
};

type FortnightBundle = {
  label: string;
  transactions: TransactionRow[];
  summary: FortnightSummary;
  fortnightId: number;
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

export default function MonthlyFortnightView({
  ownerKey,
  year,
  month,
  suggestedPeriod,
  first,
  second,
}: MonthlyFortnightViewProps) {
  const [layout, setLayout] = useState<LayoutMode>('single');
  const [period, setPeriod] = useState<FortnightPeriod>(suggestedPeriod);
  const [summaryVisible, setSummaryVisible] = useState(true);

  useEffect(() => {
    const storedLayout = readStoredLayout();
    const storedPeriod = readStoredPeriod();
    const storedSummary = readStoredSummaryVisible();
    if (storedLayout) {
      setLayout(storedLayout);
    }
    if (storedPeriod) {
      setPeriod(storedPeriod);
    }
    if (storedSummary !== null) {
      setSummaryVisible(storedSummary);
    }
  }, []);

  const handleLayoutRadio = useCallback((value: string) => {
    if (value === 'single') {
      setLayout('single');
      persistLayout('single');
      return;
    }
    if (value === 'both') {
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

  return (
    <div className="space-y-4">
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-start"
        role="region"
        aria-label="Controles de vista de planificación"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                'h-9 gap-2 rounded-xl border-border/60 px-3 shadow-sm',
                'hover:bg-muted/40',
              )}
              aria-haspopup="menu"
              aria-label={`Vista de planificación: ${vistaChip}. Abrir opciones.`}
            >
              <SlidersHorizontal
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="text-sm font-medium">Vista</span>
              <span
                className="max-w-[140px] truncate text-xs font-medium text-muted-foreground sm:max-w-[200px]"
                aria-hidden
              >
                {vistaChip}
              </span>
              <ChevronDown
                className="h-4 w-4 shrink-0 opacity-50"
                aria-hidden
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
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
                    <span className="truncate">
                      1ª — {first.label}
                    </span>
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem
                    value="SECOND"
                    title={second.label}
                    className="max-w-[min(100vw-2rem,18rem)]"
                  >
                    <span className="truncate">
                      2ª — {second.label}
                    </span>
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
          />
        ) : null}
      </div>
    </div>
  );
}
