'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BarChart3, EyeOff } from 'lucide-react';

type FortnightPeriod = 'FIRST' | 'SECOND';

type FortnightViewControlsProps = {
  year: number;
  month: number;
  period: FortnightPeriod;
  firstLabel: string;
  secondLabel: string;
  summaryVisible: boolean;
  onPeriodChange: (period: FortnightPeriod) => void;
  onSummaryVisibleChange: (visible: boolean) => void;
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
  period,
  firstLabel,
  secondLabel,
  summaryVisible,
  onPeriodChange,
  onSummaryVisibleChange,
}: FortnightViewControlsProps) => {
  const monthLastDay = new Date(year, month, 0).getDate();
  const firstRange = '1–15';
  const secondRange = `16–${monthLastDay}`;

  const handleToggleSummary = () => {
    onSummaryVisibleChange(!summaryVisible);
  };

  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      role="region"
      aria-label="Controles de vista de planificación"
    >
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

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 shrink-0 gap-1.5 self-end rounded-lg px-3 text-xs font-semibold sm:self-center"
        onClick={handleToggleSummary}
        aria-pressed={summaryVisible}
        aria-label={
          summaryVisible
            ? 'Ocultar resumen de la quincena'
            : 'Mostrar resumen de la quincena'
        }
      >
        {summaryVisible ? (
          <>
            <EyeOff className="h-4 w-4 shrink-0" aria-hidden />
            Ocultar resumen
          </>
        ) : (
          <>
            <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
            Mostrar resumen
          </>
        )}
      </Button>
    </div>
  );
};
