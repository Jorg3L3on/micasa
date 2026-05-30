'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Landmark,
  MoreHorizontal,
  Pencil,
  Receipt,
  RotateCcw,
  ShoppingCart,
  SlidersHorizontal,
  Upload,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  creditCardDetailTabTriggerClass,
  creditCardSegmentedTabChromeClass,
  creditCardSegmentedTabListClass,
} from '@/components/credit-cards/credit-card-segmented-tabs';
import {
  kpiMetricCardShellClass,
  kpiMetricLabelClass,
  kpiMetricValueClass,
  type KpiMetricTone,
} from '@/components/finance/kpi-metric-card-styles';
import { getProviderCardStyle } from '@/lib/provider-card-style';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import type {
  CreditCardListItem,
  CreditCardStatementPurchaseItem,
  CreditCardStatementResponse,
} from '@/types/catalog';

export const CreditCardDetailTabsList = ({
  children,
}: {
  children: ReactNode;
}) => (
  <div className={creditCardSegmentedTabChromeClass}>
    <TabsList variant="line" className={creditCardSegmentedTabListClass}>
      {children}
    </TabsList>
  </div>
);

export const CreditCardDetailTabTrigger = ({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) => (
  <TabsTrigger value={value} className={creditCardDetailTabTriggerClass}>
    {children}
  </TabsTrigger>
);

type SheetMetric = {
  key: string;
  label: string;
  value: string;
  tone: KpiMetricTone;
  action?: ReactNode;
};

type SheetMetricsProps = {
  metrics: SheetMetric[];
};

const CreditCardSheetMetrics = ({ metrics }: SheetMetricsProps) => (
  <div
    className="grid grid-cols-3 gap-1 sm:gap-1.5"
    role="group"
    aria-label="Métricas del ciclo"
  >
    {metrics.map(({ key, label, value, tone, action }) => (
      <div key={key} className={cn('flex min-w-0 flex-col', kpiMetricCardShellClass(tone))}>
        <div className="mb-1 flex items-center justify-between gap-1">
          <p className={kpiMetricLabelClass(tone)}>{label}</p>
          {action}
        </div>
        <p
          className={cn(
            'truncate font-mono text-base font-bold tabular-nums leading-none sm:text-lg',
            kpiMetricValueClass(tone),
          )}
        >
          {value}
        </p>
      </div>
    ))}
  </div>
);

const CATEGORY_BAR_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-sky-500',
] as const;

export const CreditCardHeroZone = ({ children }: { children: ReactNode }) => (
  <div className="relative -mx-4 overflow-hidden px-4 pb-2 sm:-mx-0 sm:rounded-b-[1.75rem]">
    <div
      className="pointer-events-none absolute inset-0 bg-linear-to-b from-violet-500/14 via-indigo-500/6 to-transparent dark:from-violet-950/85 dark:via-indigo-950/45 dark:to-background"
      aria-hidden
    />
    <div
      className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl dark:bg-violet-600/30"
      aria-hidden
    />
    <div
      className="pointer-events-none absolute -right-20 top-8 h-48 w-48 rounded-full bg-indigo-500/15 blur-3xl dark:bg-blue-600/25"
      aria-hidden
    />
    <div className="relative space-y-4">{children}</div>
  </div>
);

export const CreditCardActivitySheet = ({ children }: { children: ReactNode }) => (
  <div
    className={cn(
      'relative z-10 -mt-3',
      'shadow-[0_-10px_40px_-16px_rgba(0,0,0,0.12)] dark:shadow-[0_-10px_40px_-16px_rgba(0,0,0,0.45)]',
    )}
  >
    <div className="rounded-t-[1.75rem] border border-border/60 bg-card px-4 pt-3 pb-4">
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-muted-foreground/20" aria-hidden />
      <div>{children}</div>
    </div>
  </div>
);

type CycleSpendingBarProps = {
  items: CreditCardStatementPurchaseItem[];
  total: number;
  cycleLabel?: string;
};

export const CreditCardCycleSpendingBar = ({
  items,
  total,
  cycleLabel = 'Compras del ciclo',
}: CycleSpendingBarProps) => {
  const segments = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.category, (map.get(item.category) ?? 0) + Number(item.amount));
    }
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([category, amount], index) => ({
        category,
        amount,
        color: CATEGORY_BAR_COLORS[index % CATEGORY_BAR_COLORS.length],
        pct: total > 0 ? (amount / total) * 100 : 0,
      }));
  }, [items, total]);

  if (total <= 0 && items.length === 0) {
    return null;
  }

  return (
    <div
      className="rounded-2xl border border-border/50 bg-card/60 px-4 py-3 backdrop-blur-sm dark:bg-card/40"
      role="region"
      aria-label={cycleLabel}
    >
      <div className="mb-2 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {cycleLabel}
          </p>
          <p className="font-mono text-xl font-bold tabular-nums tracking-tight">
            {formatCurrency(total)}
          </p>
        </div>
        {segments.length > 0 ? (
          <p className="text-[10px] text-muted-foreground">
            {segments.length} categoría{segments.length === 1 ? '' : 's'}
          </p>
        ) : null}
      </div>

      {segments.length > 0 ? (
        <>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
            {segments.map(({ category, pct, color }) => (
              <div
                key={category}
                className={cn('h-full first:rounded-l-full last:rounded-r-full', color)}
                style={{ width: `${Math.max(pct, 2)}%` }}
                title={`${category}: ${pct.toFixed(0)}%`}
              />
            ))}
          </div>
          <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
            {segments.slice(0, 4).map(({ category, amount, color }) => (
              <li
                key={category}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
              >
                <span className={cn('inline-block h-1.5 w-1.5 rounded-full', color)} />
                <span className="max-w-[5.5rem] truncate">{category}</span>
                <span className="font-mono tabular-nums text-foreground/80">
                  {formatCurrency(amount)}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Sin compras en este ciclo.</p>
      )}
    </div>
  );
};

type HeaderActionsProps = {
  card: CreditCardListItem;
  backHref: string;
  onOpenImportDialog: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  onEditCard: () => void;
  onAdjustBalance?: () => void;
};

export const CreditCardDetailHeaderActions = ({
  card,
  backHref,
  onOpenImportDialog,
  onExportCsv,
  onExportPdf,
  onEditCard,
  onAdjustBalance,
}: HeaderActionsProps) => (
  <div className="flex items-center justify-between gap-2">
    <Link
      href={backHref}
      className="inline-flex h-9 min-w-0 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Volver a billeteras"
    >
      <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
      <span className="truncate sm:inline">Billeteras</span>
    </Link>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={`Más acciones para ${card.name}`}
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onEditCard} className="cursor-pointer">
          <Pencil className="mr-2 h-4 w-4 shrink-0" />
          Editar tarjeta
        </DropdownMenuItem>
        {onAdjustBalance ? (
          <DropdownMenuItem onClick={onAdjustBalance} className="cursor-pointer">
            <SlidersHorizontal className="mr-2 h-4 w-4 shrink-0" />
            Ajustar deuda
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={onOpenImportDialog} className="cursor-pointer">
          <Upload className="mr-2 h-4 w-4 shrink-0" />
          Importar estado de cuenta
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportCsv} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4 shrink-0" />
          Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportPdf} className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4 shrink-0" />
          Exportar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);

type VisualHeroProps = {
  card: CreditCardListItem;
  statement: CreditCardStatementResponse;
  utilizationPct: number | null;
};

export const CreditCardVisualHero = ({
  card,
  statement,
  utilizationPct,
}: VisualHeroProps) => {
  const cardStyle = useMemo(
    () => getProviderCardStyle(card.provider_icon_key, card.type, 'wow'),
    [card.provider_icon_key, card.type],
  );

  const limit = statement.credit_limit ?? 0;

  return (
    <div
      className="relative mx-auto w-full max-w-md lg:max-w-lg"
      role="region"
      aria-label={`Tarjeta ${card.name}`}
    >
      <div
        className={cn(
          'relative aspect-[1.586/1] w-full overflow-hidden rounded-2xl border p-4 text-white shadow-xl ring-1 ring-inset ring-white/10 sm:p-5',
          !cardStyle &&
            'border-violet-500/40 bg-linear-to-br from-violet-600/90 via-indigo-950 to-slate-950',
        )}
        style={cardStyle}
      >
        <span
          className="pointer-events-none absolute -left-12 -top-12 h-32 w-32 rounded-full bg-white/10 blur-3xl"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -bottom-10 -right-8 h-28 w-28 rounded-full bg-white/8 blur-2xl"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent"
          aria-hidden
        />

        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {card.provider_icon_key ? (
                <WalletProviderIcon
                  providerIconKey={card.provider_icon_key}
                  className="h-8 w-8 shrink-0 rounded-lg border border-white/25 bg-white/15 shadow-sm ring-1 ring-white/10"
                  iconClassName="h-4 w-4"
                />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/15">
                  <CreditCard className="h-4 w-4" aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight opacity-95">
                  {card.name}
                </p>
                <p className="text-[10px] uppercase tracking-widest opacity-60">
                  Corte {card.cutoff_day} · Pago {card.due_day}
                </p>
              </div>
            </div>
            <span className="font-mono text-[11px] tracking-[0.2em] opacity-50">
              •••• ••••
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                Deuda actual
              </p>
              <p className="text-3xl font-bold font-mono tabular-nums tracking-tight sm:text-4xl">
                {formatCurrency(statement.outstanding_balance)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs opacity-90">
              <div>
                <p className="text-[9px] uppercase tracking-wider opacity-70">
                  Disponible
                </p>
                <p
                  className={cn(
                    'font-mono text-sm font-semibold tabular-nums',
                    (statement.available_credit ?? 0) < 0 && 'text-red-200',
                  )}
                >
                  {statement.available_credit == null
                    ? 'Sin línea'
                    : formatCurrency(statement.available_credit)}
                </p>
              </div>
              {limit > 0 ? (
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-wider opacity-70">
                    Límite
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums">
                    {formatCurrency(limit)}
                  </p>
                </div>
              ) : null}
            </div>

            {utilizationPct != null && limit > 0 ? (
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] opacity-70">
                  <span>Utilización</span>
                  <span className="font-mono tabular-nums">{utilizationPct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white/85 transition-all"
                    style={{ width: `${utilizationPct}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

type DuePaymentStripProps = {
  statement: CreditCardStatementResponse;
  daysUntilDue: number;
};

export const CreditCardDuePaymentStrip = ({
  statement,
  daysUntilDue,
}: DuePaymentStripProps) => {
  const hasPendingDue = statement.next_due_payment > 0;

  const dueLabel = !hasPendingDue
    ? 'Sin pago pendiente'
    : daysUntilDue < 0
      ? `Vencido hace ${Math.abs(daysUntilDue)} d`
      : daysUntilDue === 0
        ? 'Vence hoy'
        : `Vence en ${daysUntilDue} d`;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2.5 backdrop-blur-sm',
        !hasPendingDue
          ? 'border-border/50 bg-card/50 dark:bg-card/30'
          : daysUntilDue < 0
            ? 'border-destructive/35 bg-destructive/5'
            : daysUntilDue <= 5
              ? 'border-amber-500/35 bg-amber-500/5'
              : 'border-border/50 bg-card/50 dark:bg-card/30',
      )}
      role="status"
      aria-label="Próximo pago"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pago próximo
        </p>
        <p className="font-mono text-lg font-bold tabular-nums leading-tight">
          {formatCurrency(statement.next_due_payment)}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <Badge
          variant="outline"
          className={cn(
            'gap-1 text-[10px] font-medium',
            !hasPendingDue
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
              : daysUntilDue < 0
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : daysUntilDue <= 5
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-border/60 text-muted-foreground',
          )}
        >
          <CalendarClock className="h-3 w-3" aria-hidden />
          {dueLabel}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {formatDate(statement.statement_due_date)}
        </span>
      </div>
    </div>
  );
};

type QuickActionsProps = {
  onOpenPaymentDialog: () => void;
  onOpenPurchaseDialog: () => void;
  onOpenImportDialog: () => void;
  onAdjustBalance?: () => void;
};

export const CreditCardQuickActions = ({
  onOpenPaymentDialog,
  onOpenPurchaseDialog,
  onOpenImportDialog,
  onAdjustBalance,
}: QuickActionsProps) => {
  const actions: {
    key: string;
    label: string;
    ariaLabel?: string;
    icon: typeof Wallet;
    onClick: () => void;
  }[] = [
    {
      key: 'pay',
      label: 'Pagar',
      icon: Wallet,
      onClick: onOpenPaymentDialog,
    },
    {
      key: 'purchase',
      label: 'Compra',
      icon: ShoppingCart,
      onClick: onOpenPurchaseDialog,
    },
    {
      key: 'import',
      label: 'Estado de cuenta',
      ariaLabel: 'Importar estado de cuenta',
      icon: Upload,
      onClick: onOpenImportDialog,
    },
    ...(onAdjustBalance
      ? [
          {
            key: 'adjust',
            label: 'Ajustar',
            icon: SlidersHorizontal,
            onClick: onAdjustBalance,
          },
        ]
      : []),
  ];

  return (
    <div
      className="flex justify-around gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide sm:justify-center sm:gap-6"
      role="group"
      aria-label="Acciones rápidas"
    >
      {actions.map(({ key, label, ariaLabel, icon: Icon, onClick }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          className="flex min-w-[4.25rem] shrink-0 flex-col items-center gap-2 transition-opacity hover:opacity-90 active:opacity-75"
          aria-label={ariaLabel ?? label}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/15 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/8">
            <Icon className="h-5 w-5 text-foreground dark:text-white" aria-hidden />
          </span>
          <span className="max-w-[4.5rem] text-center text-[11px] font-medium leading-tight text-muted-foreground">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
};

/** @deprecated Use CreditCardDuePaymentStrip + CreditCardQuickActions */
export const CreditCardNextPaymentHero = CreditCardDuePaymentStrip;

type CycleSummaryProps = {
  statement: CreditCardStatementResponse;
  isCurrentCycle: boolean;
  onPreviousCycle: () => void;
  onNextCycle: () => void;
  onResetToToday: () => void;
  formatCycleRange: (start: string, end: string) => string;
  onAdjustDebt?: () => void;
};

export const CreditCardCycleSummary = ({
  statement,
  isCurrentCycle,
  onPreviousCycle,
  onNextCycle,
  onResetToToday,
  formatCycleRange,
  onAdjustDebt,
}: CycleSummaryProps) => {
  const metrics: SheetMetric[] = [
    {
      key: 'debt',
      label: 'Deuda',
      value: formatCurrency(statement.outstanding_balance),
      tone: 'destructive',
      action: onAdjustDebt ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 text-destructive/70 hover:text-destructive"
              onClick={onAdjustDebt}
              aria-label="Ajustar deuda registrada"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Alinear deuda con el emisor</TooltipContent>
        </Tooltip>
      ) : undefined,
    },
    {
      key: 'available',
      label: 'Disponible',
      value:
        statement.available_credit == null
          ? 'Sin línea'
          : formatCurrency(statement.available_credit),
      tone:
        statement.available_credit == null
          ? 'neutral'
          : statement.available_credit < 0
            ? 'destructive'
            : 'emerald',
    },
    {
      key: 'purchases',
      label: 'Compras ciclo',
      value: formatCurrency(statement.current_cycle_purchases),
      tone: 'blue',
    },
  ];

  return (
    <div className="space-y-4" role="region" aria-label="Ciclo y métricas">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={onPreviousCycle}
          aria-label="Ciclo anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1 rounded-2xl border border-border/50 bg-muted/20 px-3 py-2 text-center dark:bg-muted/10">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isCurrentCycle ? 'Ciclo actual' : 'Ciclo seleccionado'}
          </p>
          <p className="truncate text-xs font-semibold tabular-nums sm:text-sm">
            {formatCycleRange(statement.current_cycle_start, statement.current_cycle_end)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={onNextCycle}
          disabled={isCurrentCycle}
          aria-label="Ciclo siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isCurrentCycle ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-full px-2.5 text-[10px]"
            onClick={onResetToToday}
            aria-label="Volver al ciclo actual"
          >
            <RotateCcw className="mr-1 h-3 w-3" aria-hidden />
            Hoy
          </Button>
        ) : null}
      </div>

      <CreditCardSheetMetrics metrics={metrics} />
    </div>
  );
};

type StatementSummaryCardProps = {
  statement: CreditCardStatementResponse;
  daysUntilDue: number;
};

export const CreditCardStatementSummaryCard = ({
  statement,
  daysUntilDue,
}: StatementSummaryCardProps) => {
  const hasPendingDue = statement.next_due_payment > 0;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
          <Receipt className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        </span>
        <div>
          <CardTitle className="text-sm font-semibold leading-none">
            Estado de cuenta
          </CardTitle>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Corte y saldos del periodo
          </p>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-border/40 p-0 pb-0">
        <div className="flex items-center justify-between px-4 py-2.5 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Receipt className="h-3 w-3 text-violet-500" />
            Periodo
          </span>
          <span className="text-right font-medium">
            {formatDate(statement.statement_start)} – {formatDate(statement.statement_end)}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Landmark className="h-3 w-3 text-blue-500" />
            {statement.imported_statement_total != null
              ? 'Total importado'
              : 'Saldo del corte'}
          </span>
          <span className="font-mono tabular-nums font-medium">
            {formatCurrency(
              statement.imported_statement_total ?? statement.last_statement_balance,
            )}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 text-xs">
          <span className="text-muted-foreground">Pagos desde corte</span>
          <span className="font-mono tabular-nums font-medium">
            {formatCurrency(statement.payments_since_last_cutoff)}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 text-xs">
          <span className="text-muted-foreground">Pagos aplicados</span>
          <span className="font-mono tabular-nums font-medium">
            {formatCurrency(statement.payments_applied_to_statement)}
          </span>
        </div>
        <div
          className={cn(
            'flex items-center justify-between px-4 py-3 text-sm font-semibold',
            !hasPendingDue
              ? 'bg-muted/30 text-foreground'
              : daysUntilDue < 0
                ? 'bg-destructive/8 text-destructive'
                : daysUntilDue <= 5
                  ? 'bg-amber-500/8 text-amber-700 dark:text-amber-300'
                  : 'bg-muted/30',
          )}
        >
          <span>Por pagar</span>
          <span className="font-mono tabular-nums">
            {formatCurrency(statement.next_due_payment)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

type ActivitySectionCardProps = {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  accentClass?: string;
  badge?: ReactNode;
  children: ReactNode;
};

export const CreditCardActivitySectionCard = ({
  title,
  subtitle,
  icon,
  accentClass = 'border-l-violet-500/50',
  badge,
  children,
}: ActivitySectionCardProps) => (
  <Card
    className={cn('overflow-hidden border-border/60 border-l-[3px]', accentClass)}
  >
    <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
      {icon}
      <div className="min-w-0 flex-1">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {badge}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);
