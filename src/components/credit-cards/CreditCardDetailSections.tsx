'use client';

import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Landmark,
  Receipt,
  RotateCcw,
  ShoppingCart,
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
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { CreditCardListItem, CreditCardStatementResponse } from '@/types/catalog';

type HeaderActionsProps = {
  card: CreditCardListItem;
  onOpenImportDialog: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
};

export const CreditCardDetailHeaderActions = ({
  card,
  onOpenImportDialog,
  onExportCsv,
  onExportPdf,
}: HeaderActionsProps) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 dark:bg-violet-500/15">
        <CreditCard className="h-4 w-4 text-violet-600 dark:text-violet-400" />
      </span>
      <div>
        <h1 className="text-xl font-semibold">{card.name}</h1>
        <p className="text-xs text-muted-foreground">
          Corte dia {card.cutoff_day} - Pago dia {card.due_day}
        </p>
      </div>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-1.5 self-start sm:self-auto"
          aria-label="Mas acciones"
        >
          <ChevronDown className="h-4 w-4 opacity-70" />
          Mas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onOpenImportDialog} className="cursor-pointer">
          <Upload className="mr-2 h-4 w-4 shrink-0" />
          Importar PDF
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

type NextPaymentHeroProps = {
  statement: CreditCardStatementResponse;
  daysUntilDue: number;
  utilizationPct: number | null;
  onOpenPaymentDialog: () => void;
  onOpenPurchaseDialog: () => void;
};

export const CreditCardNextPaymentHero = ({
  statement,
  daysUntilDue,
  utilizationPct,
  onOpenPaymentDialog,
  onOpenPurchaseDialog,
}: NextPaymentHeroProps) => (
  <div
    className={cn(
      'rounded-xl border-2 p-5 transition-colors',
      daysUntilDue < 0
        ? 'border-destructive/60 bg-destructive/5'
        : daysUntilDue <= 5
          ? 'border-amber-500/60 bg-amber-500/5'
          : daysUntilDue <= 10
            ? 'border-yellow-500/40 bg-yellow-500/5'
            : 'border-border/60 bg-card',
    )}
  >
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pago proximo
        </p>
        <p className="text-4xl font-bold font-mono tabular-nums">
          {formatCurrency(statement.next_due_payment)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 text-xs font-medium',
              daysUntilDue < 0
                ? 'border-destructive/40 bg-destructive/10 text-destructive'
                : daysUntilDue <= 5
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : daysUntilDue <= 10
                    ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                    : 'border-border/60 text-muted-foreground',
            )}
          >
            <CalendarClock className="h-3 w-3" />
            {daysUntilDue < 0
              ? `Vencido hace ${Math.abs(daysUntilDue)} dia${Math.abs(daysUntilDue) === 1 ? '' : 's'}`
              : daysUntilDue === 0
                ? 'Vence hoy'
                : `Vence en ${daysUntilDue} dia${daysUntilDue === 1 ? '' : 's'}`}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatDate(statement.statement_due_date)}
          </span>
          {statement.minimum_payment != null &&
            statement.minimum_payment !== statement.next_due_payment && (
              <span className="text-xs text-muted-foreground">
                Minimo: {formatCurrency(statement.minimum_payment)}
              </span>
            )}
        </div>
        {utilizationPct != null && (
          <div className="max-w-xs space-y-1 pt-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Utilizacion de credito</span>
              <span className="font-mono tabular-nums">{utilizationPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  utilizationPct > 80
                    ? 'bg-destructive'
                    : utilizationPct > 50
                      ? 'bg-amber-500'
                      : 'bg-emerald-500',
                )}
                style={{ width: `${utilizationPct}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
        <Button
          type="button"
          className="gap-2 rounded-xl shadow-sm"
          onClick={onOpenPaymentDialog}
        >
          <Wallet className="h-4 w-4 shrink-0" />
          Registrar pago
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={onOpenPurchaseDialog}
        >
          <ShoppingCart className="h-4 w-4 shrink-0" />
          Registrar compra
        </Button>
      </div>
    </div>
  </div>
);

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
}: CycleSummaryProps) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-center gap-1 self-start rounded-lg border border-border/60 bg-muted/40 px-1 py-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onPreviousCycle}
        aria-label="Ciclo anterior"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>
      <div className="min-w-0 px-2 text-center">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Ciclo
        </p>
        <p className="text-xs font-semibold tabular-nums">
          {formatCycleRange(statement.current_cycle_start, statement.current_cycle_end)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onNextCycle}
        disabled={isCurrentCycle}
        aria-label="Ciclo siguiente"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
      {!isCurrentCycle && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-1.5 text-[10px]"
          onClick={onResetToToday}
          aria-label="Volver al ciclo actual"
        >
          <RotateCcw className="h-3 w-3" />
          Hoy
        </Button>
      )}
    </div>
    <div className="flex flex-wrap gap-2">
      <div className="rounded-lg border border-l-[3px] border-l-violet-500/50 bg-violet-500/5 px-3 py-2 dark:bg-violet-500/8">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Deuda actual
        </p>
        <p className="text-sm font-bold font-mono tabular-nums">
          {formatCurrency(statement.outstanding_balance)}
        </p>
      </div>
      <div className="rounded-lg border border-l-[3px] border-l-emerald-500/50 bg-emerald-500/5 px-3 py-2 dark:bg-emerald-500/8">
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
            ? 'Sin linea'
            : formatCurrency(statement.available_credit)}
        </p>
      </div>
      <div className="rounded-lg border border-l-[3px] border-l-blue-500/50 bg-blue-500/5 px-3 py-2 dark:bg-blue-500/8">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Compras ciclo
        </p>
        <p className="text-sm font-bold font-mono tabular-nums">
          {formatCurrency(statement.current_cycle_purchases)}
        </p>
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
}: StatementSummaryCardProps) => (
  <Card className="overflow-hidden border-border/60">
    <CardHeader className="pb-2">
      <CardTitle className="text-sm font-semibold">Estado de cuenta</CardTitle>
    </CardHeader>
    <CardContent className="divide-y divide-border/40 p-0 pb-0">
      <div className="flex items-center justify-between px-4 py-2.5 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Receipt className="h-3 w-3 text-violet-500" />
          Periodo
        </span>
        <span className="text-right font-medium">
          {formatDate(statement.statement_start)} - {formatDate(statement.statement_end)}
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
          daysUntilDue < 0
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
