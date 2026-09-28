import type { ReactNode } from 'react';
import { formatCurrency } from '@/lib/utils';

export type ChartTooltipEntry = {
  name?: string;
  value?: number | string;
  dataKey?: string | number;
};

type ChartTooltipProps = {
  active?: boolean;
  label?: ReactNode;
  payload?: ChartTooltipEntry[];
  children?: ReactNode;
};

/** The only chart tooltip. Pass rows as children, or a Recharts payload. */
export const ChartTooltip = ({
  active,
  label,
  payload,
  children,
}: ChartTooltipProps) => {
  if (!active) return null;

  const rows = (payload ?? []).filter(
    (entry) => entry.value != null && entry.value !== '',
  );

  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-caption text-popover-foreground shadow-panel">
      {label != null && label !== '' ? (
        <p className="mb-1 font-medium text-foreground">{label}</p>
      ) : null}
      {children}
      {children == null
        ? rows.map((entry) => (
            <p
              key={String(entry.dataKey ?? entry.name)}
              className="font-sans tabular-nums text-foreground"
            >
              {entry.name ? `${entry.name}: ` : null}
              {formatCurrency(Number(entry.value))}
            </p>
          ))
        : null}
    </div>
  );
};
