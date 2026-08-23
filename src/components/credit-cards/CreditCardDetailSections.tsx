'use client';

import { useMemo, type ReactNode } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Landmark,
  Receipt,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  creditCardDetailTabTriggerClass,
  creditCardSegmentedTabChromeClass,
  creditCardSegmentedTabListClass,
} from '@/components/credit-cards/credit-card-segmented-tabs';
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

const CATEGORY_BAR_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-sky-500',
] as const;

export const CreditCardHeroZone = ({ children }: { children: ReactNode }) => (
  <div className="relative -mx-4 px-4 pb-2 sm:-mx-0 sm:pb-3">
    <div className="relative space-y-4">{children}</div>
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

type VisualHeroProps = {
  card: CreditCardListItem;
  statement: CreditCardStatementResponse;
  utilizationPct: number | null;
  isCurrentCycle?: boolean;
};

export const CreditCardVisualHero = ({
  card,
  statement,
  utilizationPct,
  isCurrentCycle = true,
}: VisualHeroProps) => {
  const cardStyle = useMemo(
    () => getProviderCardStyle(card.provider_icon_key, card.type, 'wow'),
    [card.provider_icon_key, card.type],
  );

  const limit = statement.credit_limit ?? 0;

  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-md lg:max-w-lg transition-opacity',
        !isCurrentCycle && 'opacity-80',
      )}
      role="region"
      aria-label={`Tarjeta ${card.name}`}
    >
      <div
        className={cn(
          // Grow with content (no fixed aspect): utilization + amounts clip on
          // narrow viewports when locked to aspect-[1.586/1] + overflow-hidden.
          'relative w-full overflow-hidden rounded-[1.375rem] border p-4 pb-5 text-white shadow-xl ring-1 ring-inset ring-white/10 sm:p-5 sm:pb-6',
          !cardStyle &&
            'border-slate-500/40 bg-linear-to-br from-slate-700 via-slate-900 to-slate-950',
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

        <div className="relative flex min-h-[12rem] flex-col justify-between gap-4 sm:min-h-[13.5rem]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {card.provider_icon_key ? (
                <WalletProviderIcon
                  providerIconKey={card.provider_icon_key}
                  className="h-8 w-8 shrink-0 rounded-lg border border-white/25 bg-white/15 shadow-sm ring-1 ring-white/10"
                  iconClassName="h-4 w-4" data-icon="inline-start" />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/15">
                  <CreditCard className="h-4 w-4" aria-hidden data-icon="inline-start" />
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
                {isCurrentCycle ? 'Deuda actual' : 'Deuda hoy'}
              </p>
              <p className="text-3xl font-bold font-mono tabular-nums leading-snug tracking-tight sm:text-4xl">
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
                    'font-mono text-sm font-semibold tabular-nums leading-snug',
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
                  <p className="font-mono text-sm font-semibold tabular-nums leading-snug">
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
          <CalendarClock className="h-3 w-3" aria-hidden data-icon="inline-start" />
          {dueLabel}
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {formatDate(statement.statement_due_date)}
        </span>
      </div>
    </div>
  );
};

/** @deprecated Use CreditCardDuePaymentStrip */
export const CreditCardNextPaymentHero = CreditCardDuePaymentStrip;

type CycleSummaryProps = {
  statement: CreditCardStatementResponse;
  isCurrentCycle: boolean;
  onPreviousCycle: () => void;
  onNextCycle: () => void;
  onResetToToday: () => void;
  formatCycleRange: (start: string, end: string) => string;
};

export const CreditCardCycleSummary = ({
  statement,
  isCurrentCycle,
  onPreviousCycle,
  onNextCycle,
  onResetToToday,
  formatCycleRange,
}: CycleSummaryProps) => {
  return (
    <div role="region" aria-label="Navegación de ciclo">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          onClick={onPreviousCycle}
          aria-label="Ciclo anterior"
        >
          <ChevronLeft className="h-4 w-4" data-icon="inline-start" />
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
          <ChevronRight className="h-4 w-4" data-icon="inline-end" />
        </Button>
        {!isCurrentCycle ? (
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 rounded-full px-2.5 text-[10px]"
            onClick={onResetToToday}
            aria-label="Volver al ciclo actual"
          >
            <RotateCcw
              className="mr-1 h-3 w-3"
              aria-hidden
              data-icon="inline-start"
            />
            Hoy
          </Button>
        ) : null}
      </div>
    </div>
  );
};

type StatementSummaryCardProps = {
  statement: CreditCardStatementResponse;
  daysUntilDue: number;
  collapsible?: boolean;
};

export const CreditCardStatementSummaryCard = ({
  statement,
  daysUntilDue,
  collapsible = false,
}: StatementSummaryCardProps) => {
  const hasPendingDue = statement.next_due_payment > 0;

  const body = (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
          <Receipt className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" data-icon="inline-start" />
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
            <Receipt className="h-3 w-3 text-violet-500" data-icon="inline-start" />
            Periodo
          </span>
          <span className="text-right font-medium">
            {formatDate(statement.statement_start)} – {formatDate(statement.statement_end)}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Landmark className="h-3 w-3 text-blue-500" data-icon="inline-start" />
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

  if (!collapsible) {
    return body;
  }

  return (
    <details className="group rounded-2xl border border-border/60 bg-card/50 open:pb-0">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
        Detalle del corte
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {formatDate(statement.statement_start)} – {formatDate(statement.statement_end)}
        </span>
      </summary>
      <div className="border-t border-border/50 px-1 pb-1 pt-0">{body}</div>
    </details>
  );
};

type ActivitySectionCardProps = {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
};

export const CreditCardActivitySectionCard = ({
  title,
  subtitle,
  icon,
  badge,
  children,
}: ActivitySectionCardProps) => (
  <Card className="overflow-hidden border-border/60">
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
