import { cn } from '@/lib/utils';

/** Head → tail along the mark gradient (#2563EB → #8B3FD9). */
const COMET_TRAIL_COLORS = [
  '#2563eb',
  '#395ce7',
  '#4e55e4',
  '#624de0',
  '#7746dd',
  '#8b3fd9',
] as const;

type BrandLoaderProps = {
  /** Orbit diameter in px; mark and trail scale from it. */
  size?: number;
  label?: string;
  className?: string;
};

/**
 * MiCasa loader: the roof + "M" mark inside an orbiting comet (beUI Comet geometry).
 * Pure CSS animation so it runs from server-streamed HTML before hydration.
 */
export function BrandLoader({
  size = 104,
  label = 'Cargando MiCasa',
  className,
}: BrandLoaderProps) {
  const head = size * 0.12;
  const orbitRadius = size / 2 - head / 2;
  const tile = size * 0.62;
  const mark = size * 0.42;

  return (
    <span
      role="status"
      aria-label={label}
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden
        className="absolute rounded-full border border-white/10"
        style={{ inset: head / 2 }}
      />
      <span
        aria-hidden
        className="brand-loader-breathe absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[28%] border border-white/[0.08] bg-white/[0.04] shadow-[0_0_32px_-6px_rgba(37,99,235,0.55)] backdrop-blur-xl"
        style={{ width: tile, height: tile }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- must render before hydration without the image optimizer */}
        <img
          src="/brand/mark.svg"
          alt=""
          width={mark}
          height={mark}
          style={{ width: mark, height: mark }}
          fetchPriority="high"
        />
      </span>
      <span aria-hidden className="brand-comet-orbit absolute inset-0">
        {COMET_TRAIL_COLORS.map((color, index) => {
          const dot = head * (1 - index * 0.13);
          return (
            <span
              key={color}
              className="absolute top-1/2 left-1/2 rounded-full"
              style={{
                width: dot,
                height: dot,
                marginLeft: -dot / 2,
                marginTop: -dot / 2,
                backgroundColor: color,
                opacity: 1 - index * 0.16,
                transform: `rotate(${-index * 15}deg) translateY(${-orbitRadius}px)`,
                boxShadow:
                  index === 0 ? `0 0 ${head}px ${color}` : undefined,
              }}
            />
          );
        })}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
