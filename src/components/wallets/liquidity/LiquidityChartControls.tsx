'use client';

import { Undo2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { SegmentedControl } from '@/components/segmented-control';
import {
  AURA_TAB_INDICATOR_CLASS,
  GLASS_TAB_ACTIVE_LABEL_CLASS,
} from '@/components/monthly/monthly-panel-shell';
import {
  formatCustomChartRangeLabel,
  LIQUIDITY_CHART_RANGE_OPTIONS,
  type LiquidityChartRangeId,
  type LiquidityCustomChartRange,
} from '@/components/wallets/liquidity/liquidity-personalization';
import type { LiquidityChartPresetId } from '@/lib/finance/liquidity-chart-range';
import { cn } from '@/lib/utils';

type LiquidityRangeToggleProps = {
  chartRange: LiquidityChartRangeId;
  /** Window the brush picked; labels the "Personalizado" pill while it is active. */
  customRange: LiquidityCustomChartRange | null;
  /** Preset active before the window became custom; "Volver a …" restores it. */
  lastPreset: LiquidityChartPresetId;
  onChartRangeChange: (range: LiquidityChartRangeId) => void;
  className?: string;
};

/** Picks how many months the chart draws. Lives inside the chart card, next to what it changes. */
export const LiquidityRangeToggle = ({
  chartRange,
  customRange,
  lastPreset,
  onChartRangeChange,
  className,
}: LiquidityRangeToggleProps) => {
  // Five pills do not fit a phone; there the custom window is a caption under the row.
  const isMobile = useIsMobile();
  const isCustom = chartRange === 'custom';
  const customLabel =
    customRange
      ? formatCustomChartRangeLabel(customRange.fromMonthKey, customRange.toMonthKey)
      : 'Personalizado';
  const lastPresetLabel =
    LIQUIDITY_CHART_RANGE_OPTIONS.find((item) => item.value === lastPreset)?.label ?? '3M';

  const handleValueChange = (next: string) => {
    if (next === 'custom') {
      onChartRangeChange('custom');
      return;
    }
    const option = LIQUIDITY_CHART_RANGE_OPTIONS.find((item) => item.value === next);
    if (option) onChartRangeChange(option.value);
  };

  const options = LIQUIDITY_CHART_RANGE_OPTIONS.map((option) => ({
    value: option.value as string,
    label:
      option.value === 'payoff' ? (
        <>
          <span className="sm:hidden">Liquidar</span>
          <span className="hidden sm:inline">{option.label}</span>
        </>
      ) : (
        (option.label as React.ReactNode)
      ),
    ariaLabel: option.description,
    title: option.description,
  }));

  if (isCustom && !isMobile) {
    options.push({
      value: 'custom',
      label: customLabel,
      ariaLabel: `Rango personalizado: ${customLabel}`,
      title: 'Rango elegido con el control bajo la gráfica',
    });
  }

  return (
    <div className={cn('w-full min-w-0 space-y-2', className)}>
      <SegmentedControl
        value={chartRange}
        onValueChange={handleValueChange}
        ariaLabel="Meses que muestra la gráfica"
        className="w-full min-w-0"
        stretch
        wrapperClassName="min-w-0 flex-1"
        listClassName="w-full"
        indicatorClassName={AURA_TAB_INDICATOR_CLASS}
        activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
        triggerClassName="px-2.5"
        options={options}
      />
      {isCustom && isMobile ? (
        <div
          className="flex items-center justify-between gap-2 px-1 text-caption text-muted-foreground"
          aria-live="polite"
        >
          <span className="min-w-0 truncate">
            Mostrando <span className="font-semibold text-foreground">{customLabel}</span>
          </span>
          <button
            type="button"
            onClick={() => onChartRangeChange(lastPreset)}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 font-semibold text-foreground transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            <Undo2 className="size-3.5" aria-hidden />
            Volver a {lastPresetLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
};
