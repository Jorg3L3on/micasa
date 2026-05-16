'use client';

import { useCallback, useEffect, useState } from 'react';
import FortnightColumn from '@/components/FortnightColumn';
import WalletBalanceStrip from '@/components/WalletBalanceStrip';
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
  ReportsSummaryFundingFields,
  TransactionRow,
  WalletListItem,
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
} & ReportsSummaryFundingFields;

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
  wallets?: WalletListItem[];
  paidWalletIds: number[];
  isCurrentMonth: boolean;
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
  wallets = [],
  paidWalletIds,
  isCurrentMonth,
}: MonthlyFortnightViewProps) {
  const [prefsReady, setPrefsReady] = useState(false);
  const [layout, setLayout] = useState<LayoutMode>('single');
  const [period, setPeriod] = useState<FortnightPeriod>(suggestedPeriod);
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [tableDensity, setTableDensity] =
    useState<ExpenseTableDensity>('comfortable');
  const [summaryFundingRefreshNonce, setSummaryFundingRefreshNonce] = useState(0);

  const handleWalletBalancesPersisted = useCallback(() => {
    setSummaryFundingRefreshNonce((n) => n + 1);
  }, []);

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

  const walletStripSection =
    wallets.length > 0 ? (
      <div className="mb-7 min-w-0 rounded-xl border border-border/40 bg-card/80 px-3 py-2.5 shadow-sm backdrop-blur-sm dark:bg-card/60">
        <WalletBalanceStrip
          wallets={wallets}
          paidWalletIds={paidWalletIds}
          isCurrentMonth={isCurrentMonth}
          onBalancesPersisted={handleWalletBalancesPersisted}
        />
      </div>
    ) : null;

  if (!prefsReady) {
    return (
      <div
        className={cn(
          'space-y-4',
          layout === 'single' && 'mx-auto w-full max-w-4xl xl:max-w-5xl',
        )}
      >
        {walletStripSection}
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
      </div>
    );
  }

  const segmentBtn = (active: boolean) =>
    cn(
      'relative rounded-full px-3 py-1 text-xs font-bold transition-all duration-150',
      active
        ? 'bg-gradient-to-br from-primary to-primary/85 text-primary-foreground shadow-sm ring-1 ring-primary/30'
        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    );

  return (
    <div
      className={cn(
        'space-y-4',
        layout === 'single' && 'mx-auto w-full max-w-4xl xl:max-w-5xl',
      )}
    >
      {walletStripSection}
      <div
        className="flex items-center justify-end gap-1.5"
        role="region"
        aria-label="Controles de vista de planificación"
      >
        {/* Layout toggle: Una | Ambas */}
        <div className="flex items-center gap-0.5 rounded-full border border-border/50 bg-muted/40 p-0.5 shadow-inner backdrop-blur-sm">
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
          <div className="flex items-center gap-0.5 rounded-full border border-border/50 bg-muted/40 p-0.5 shadow-inner backdrop-blur-sm">
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
              className="h-8 w-8 rounded-full border border-border/50 bg-muted/40 text-muted-foreground shadow-inner backdrop-blur-sm hover:bg-muted/60 hover:text-foreground"
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
          <div className={cn(
            'flex flex-col gap-3',
            layout === 'both' && 'rounded-2xl border border-border/30 bg-card/70 p-4 shadow-sm dark:bg-card/40',
          )}>
            {layout === 'both' && (
              <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 px-3 py-2.5 shadow-sm dark:from-primary/15 dark:to-primary/8">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/20 text-xs font-black text-primary ring-1 ring-primary/30">
                    1ª
                  </span>
                  <span className="truncate text-sm font-bold text-foreground">
                    {first.label}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-primary">
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
              wallets={wallets}
              summaryFundingRefreshNonce={summaryFundingRefreshNonce}
            />
          </div>
        ) : null}
        {showSecond ? (
          <div className={cn(
            'flex flex-col gap-3',
            layout === 'both' && 'rounded-2xl border border-border/30 bg-card/70 p-4 shadow-sm dark:bg-card/40',
          )}>
            {layout === 'both' && (
              <div className="flex items-center justify-between rounded-xl border border-border/40 bg-gradient-to-r from-muted/40 to-muted/20 px-3 py-2.5 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-black text-muted-foreground ring-1 ring-border/60">
                    2ª
                  </span>
                  <span className="truncate text-sm font-bold text-foreground">
                    {second.label}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-muted-foreground">
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
              wallets={wallets}
              summaryFundingRefreshNonce={summaryFundingRefreshNonce}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
