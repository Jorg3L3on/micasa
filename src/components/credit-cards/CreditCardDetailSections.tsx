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
import { DASHBOARD_METRIC_STRIP_CLASS } from '@/components/dashboard/constants';
import { getProviderCardStyle } from '@/lib/provider-card-style';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import type { CreditCardListItem, CreditCardStatementResponse } from '@/types/catalog';

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

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        !hasPendingDue
          ? 'border-border/60 bg-card'
          : daysUntilDue < 0
            ? 'border-destructive/40 bg-destructive/5'
            : daysUntilDue <= 5
              ? 'border-amber-500/40 bg-amber-500/5'
              : 'border-border/60 bg-card',
      )}
      role="status"
      aria-label="Próximo pago"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pago próximo
          </p>
          <p className="text-2xl font-bold font-mono tabular-nums tracking-tight">
            {formatCurrency(statement.next_due_payment)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
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
              {!hasPendingDue
                ? 'Sin pago pendiente'
                : daysUntilDue < 0
                  ? `Vencido hace ${Math.abs(daysUntilDue)} día${Math.abs(daysUntilDue) === 1 ? '' : 's'}`
                  : daysUntilDue === 0
                    ? 'Vence hoy'
                    : `Vence en ${daysUntilDue} día${daysUntilDue === 1 ? '' : 's'}`}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {formatDate(statement.statement_due_date)}
            </span>
            {statement.minimum_payment != null &&
              statement.minimum_payment !== statement.next_due_payment && (
                <span className="text-[10px] text-muted-foreground">
                  Mínimo {formatCurrency(statement.minimum_payment)}
                </span>
              )}
          </div>
        </div>
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
    accent: string;
    onClick: () => void;
  }[] = [
    {
      key: 'pay',
      label: 'Pagar',
      icon: Wallet,
      accent: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      onClick: onOpenPaymentDialog,
    },
    {
      key: 'purchase',
      label: 'Compra',
      icon: ShoppingCart,
      accent: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      onClick: onOpenPurchaseDialog,
    },
    {
      key: 'import',
      label: 'Estado de cuenta',
      ariaLabel: 'Importar estado de cuenta',
      icon: Upload,
      accent: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      onClick: onOpenImportDialog,
    },
    ...(onAdjustBalance
      ? [
          {
            key: 'adjust',
            label: 'Ajustar',
            icon: SlidersHorizontal,
            accent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
            onClick: onAdjustBalance,
          },
        ]
      : []),
  ];

  return (
    <div
      className={cn(
        'grid gap-2',
        actions.length === 4 ? 'grid-cols-4' : 'grid-cols-3',
      )}
      role="group"
      aria-label="Acciones rápidas"
    >
      {actions.map(({ key, label, ariaLabel, icon: Icon, accent, onClick }) => (
        <button
          key={key}
          type="button"
          onClick={onClick}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card px-2 py-3 transition-colors hover:bg-muted/40 active:bg-muted/60"
          aria-label={ariaLabel ?? label}
        >
          <span
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full',
              accent,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <span className="text-[10px] font-medium text-foreground">{label}</span>
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
}: CycleSummaryProps) => (
  <div className="space-y-3" role="region" aria-label="Ciclo y métricas">
    <div className="flex items-center justify-center">
      <div className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/30 px-1 py-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onPreviousCycle}
          aria-label="Ciclo anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 px-2 text-center">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Ciclo actual
          </p>
          <p className="text-xs font-semibold tabular-nums">
            {formatCycleRange(statement.current_cycle_start, statement.current_cycle_end)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={onNextCycle}
          disabled={isCurrentCycle}
          aria-label="Ciclo siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!isCurrentCycle ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 rounded-full px-2 text-[10px]"
            onClick={onResetToToday}
            aria-label="Volver al ciclo actual"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            Hoy
          </Button>
        ) : null}
      </div>
    </div>

    <div className="relative -mx-1">
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-linear-to-r from-background to-transparent sm:hidden"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-linear-to-l from-background to-transparent sm:hidden"
        aria-hidden
      />
      <div className="flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-hide sm:flex-wrap sm:overflow-visible">
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'min-w-[8.5rem] shrink-0 border-l-violet-500/50 sm:min-w-0 sm:flex-1',
          )}
        >
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Deuda
              </p>
              <p className="text-sm font-bold font-mono tabular-nums">
                {formatCurrency(statement.outstanding_balance)}
              </p>
            </div>
            {onAdjustDebt ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={onAdjustDebt}
                    aria-label="Ajustar deuda registrada"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Alinear deuda con el emisor
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'min-w-[8.5rem] shrink-0 border-l-emerald-500/50 sm:min-w-0 sm:flex-1',
          )}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Disponible
          </p>
          <p
            className={cn(
              'text-sm font-bold font-mono tabular-nums',
              (statement.available_credit ?? 0) < 0 && 'text-destructive',
            )}
          >
            {statement.available_credit == null
              ? 'Sin línea'
              : formatCurrency(statement.available_credit)}
          </p>
        </div>
        <div
          className={cn(
            DASHBOARD_METRIC_STRIP_CLASS,
            'min-w-[8.5rem] shrink-0 border-l-blue-500/50 sm:min-w-0 sm:flex-1',
          )}
        >
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Compras ciclo
          </p>
          <p className="text-sm font-bold font-mono tabular-nums">
            {formatCurrency(statement.current_cycle_purchases)}
          </p>
        </div>
      </div>
    </div>
  </div>
);

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
