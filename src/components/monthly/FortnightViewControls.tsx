'use client';

import type { ReactNode } from 'react';
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
import type { ExpenseTableDensity } from '@/components/ExpenseTable';
import { cn } from '@/lib/utils';
import { SlidersHorizontal } from 'lucide-react';

type LayoutMode = 'single' | 'both';
type FortnightPeriod = 'FIRST' | 'SECOND';

type FortnightViewControlsProps = {
  year: number;
  month: number;
  layout: LayoutMode;
  period: FortnightPeriod;
  firstLabel: string;
  secondLabel: string;
  summaryVisible: boolean;
  tableDensity: ExpenseTableDensity;
  onLayoutChange: (layout: LayoutMode) => void;
  onPeriodChange: (period: FortnightPeriod) => void;
  onSummaryVisibleChange: (visible: boolean) => void;
  onTableDensityChange: (density: ExpenseTableDensity) => void;
};

const segmentButtonClass = (active: boolean) =>
  cn(
    'min-h-9 shrink-0 cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold leading-none transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    active
      ? 'border-primary/60 bg-primary text-primary-foreground shadow-sm'
      : cn(
          'border-border/70 bg-card/90 text-foreground/85 shadow-sm',
          'hover:border-primary/35 hover:bg-muted/50 hover:text-foreground',
          'active:scale-[0.98]',
        ),
  );

const controlLabelClass =
  'w-16 shrink-0 text-xs font-medium text-muted-foreground sm:w-auto';

type SegmentGroupProps = {
  label: string;
  groupLabel: string;
  children: ReactNode;
};

const SegmentGroup = ({ label, groupLabel, children }: SegmentGroupProps) => (
  <div className="flex min-w-0 items-center gap-2">
    <span className={controlLabelClass} id={`${groupLabel}-label`}>
      {label}
    </span>
    <div
      className="inline-flex flex-wrap items-center gap-1.5"
      role="group"
      aria-labelledby={`${groupLabel}-label`}
      aria-label={groupLabel}
    >
      {children}
    </div>
  </div>
);

export const FortnightViewControls = ({
  year,
  month,
  layout,
  period,
  firstLabel,
  secondLabel,
  summaryVisible,
  tableDensity,
  onLayoutChange,
  onPeriodChange,
  onSummaryVisibleChange,
  onTableDensityChange,
}: FortnightViewControlsProps) => {
  const monthLastDay = new Date(year, month, 0).getDate();
  const firstRange = '1–15';
  const secondRange = `16–${monthLastDay}`;

  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      role="region"
      aria-label="Controles de vista de planificación"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
        {layout === 'single' ? (
          <SegmentGroup label="Quincena" groupLabel="quincena">
            <button
              type="button"
              onClick={() => onPeriodChange('FIRST')}
              className={segmentButtonClass(period === 'FIRST')}
              aria-pressed={period === 'FIRST'}
              aria-label={`Primera quincena: ${firstLabel}`}
              title={firstLabel}
            >
              1ª ({firstRange})
            </button>
            <button
              type="button"
              onClick={() => onPeriodChange('SECOND')}
              className={segmentButtonClass(period === 'SECOND')}
              aria-pressed={period === 'SECOND'}
              aria-label={`Segunda quincena: ${secondLabel}`}
              title={secondLabel}
            >
              2ª ({secondRange})
            </button>
          </SegmentGroup>
        ) : null}

        <SegmentGroup label="Período" groupLabel="periodo">
          <button
            type="button"
            onClick={() => onLayoutChange('single')}
            className={segmentButtonClass(layout === 'single')}
            aria-pressed={layout === 'single'}
            aria-label="Ver una quincena"
          >
            Una quincena
          </button>
          <button
            type="button"
            onClick={() => onLayoutChange('both')}
            className={segmentButtonClass(layout === 'both')}
            aria-pressed={layout === 'both'}
            aria-label="Ver ambas quincenas"
          >
            Ambas
          </button>
        </SegmentGroup>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 self-end rounded-lg border-border/70 bg-card/90 shadow-sm hover:bg-muted/50 sm:self-center"
            aria-label="Opciones adicionales de vista"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
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
