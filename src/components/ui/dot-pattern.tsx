import { useId, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type DotPatternProps = ComponentPropsWithoutRef<'svg'> & {
  /** Tile width in px. */
  width?: number;
  /** Tile height in px. */
  height?: number;
  /** Dot center inside the tile. */
  cx?: number;
  cy?: number;
  /** Dot radius. */
  cr?: number;
};

/** Static SVG dot texture (Magic UI dot-pattern idea, no animation loop). Color via `fill-*`. */
export const DotPattern = ({
  width = 6,
  height = 6,
  cx = 1.5,
  cy = 1.5,
  cr = 0.9,
  className,
  ...props
}: DotPatternProps) => {
  const patternId = useId();

  return (
    <svg
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full fill-muted-foreground/40',
        className,
      )}
      {...props}
    >
      <defs>
        <pattern
          id={patternId}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={cx} cy={cy} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
};
