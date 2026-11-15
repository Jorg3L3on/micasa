'use client';

import { SegmentedControl } from '@/components/segmented-control';
import { AURA_TAB_INDICATOR_CLASS, GLASS_TAB_ACTIVE_LABEL_CLASS, GLASS_TAB_TRACK_CLASS } from '@/components/monthly/monthly-panel-shell';
import { cn } from '@/lib/utils';

/**
 * A choice inside a card, drawn like Panel's Gastos / Tarjetas / Préstamos
 * tabs: SegmentedControl on a faint track, glass pill with the aura halo,
 * fade when the options overflow.
 */
export const InCardTabs = <T extends string | number>({
  label,
  value,
  options,
  onChange,
  showLabel = true,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; ariaLabel?: string }[];
  onChange: (v: T) => void;
  showLabel?: boolean;
}) => (
  <div className="min-w-0">
    {showLabel ? <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">{label}</p> : null}
    <SegmentedControl
      value={String(value)}
      onValueChange={(v) => {
        const hit = options.find((o) => String(o.value) === v);
        if (hit) onChange(hit.value);
      }}
      ariaLabel={label}
      className="w-full min-w-0"
      stretch={options.length <= 4 || options.every((o) => o.label.length <= 3)}
      frameClassName={cn('flex min-w-0 items-center rounded-xl p-1', GLASS_TAB_TRACK_CLASS)}
      wrapperClassName="min-w-0 w-full flex-1"
      listClassName="min-w-full"
      triggerClassName="px-2 text-xs tabular-nums sm:text-sm"
      indicatorClassName={AURA_TAB_INDICATOR_CLASS}
      activeLabelClassName={GLASS_TAB_ACTIVE_LABEL_CLASS}
      overflowControls="fade"
      options={options.map((o) => ({ value: String(o.value), label: o.label, ariaLabel: o.ariaLabel }))}
    />
  </div>
);
