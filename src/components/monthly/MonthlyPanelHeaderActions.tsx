'use client';

import Link from 'next/link';
import { CalendarRange, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ExpenseTableDensity } from '@/components/ExpenseTable';

type MonthlyPanelHeaderActionsProps = {
  prevHref: string;
  nextHref: string | null;
  hasNextMonth: boolean;
  prevMonthLabel: string;
  nextMonthLabel: string;
  summaryVisible: boolean;
  tableDensity: ExpenseTableDensity;
  onSummaryVisibleChange: (visible: boolean) => void;
  onTableDensityChange: (density: ExpenseTableDensity) => void;
};

export const MonthlyPanelHeaderActions = ({
  prevHref,
  nextHref,
  hasNextMonth,
  prevMonthLabel,
  nextMonthLabel,
  summaryVisible,
  tableDensity,
  onSummaryVisibleChange,
  onTableDensityChange,
}: MonthlyPanelHeaderActionsProps) => {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-lg border-border/70 bg-card/90 text-xs font-semibold shadow-sm"
            aria-label="Cambiar periodo de planificación"
          >
            <CalendarRange className="h-4 w-4 shrink-0" aria-hidden />
            Cambiar periodo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Ir a otro mes
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={prevHref}>← {prevMonthLabel}</Link>
          </DropdownMenuItem>
          {hasNextMonth && nextHref ? (
            <DropdownMenuItem asChild>
              <Link href={nextHref}>{nextMonthLabel} →</Link>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-lg border-border/70 bg-card/90 text-xs font-semibold shadow-sm"
            aria-label="Filtros de vista del panel"
          >
            <Filter className="h-4 w-4 shrink-0" aria-hidden />
            Filtros
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuCheckboxItem
            checked={summaryVisible}
            onCheckedChange={onSummaryVisibleChange}
          >
            Mostrar resumen
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Densidad de tabla
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={tableDensity}
            onValueChange={(value) => {
              if (value === 'comfortable' || value === 'compact') {
                onTableDensityChange(value);
              }
            }}
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
  );
};
