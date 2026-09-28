'use client';

import type { ComponentPropsWithoutRef, CSSProperties } from 'react';
import { useReducedMotion } from 'framer-motion';
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern';
import { ShineBorder } from '@/components/ui/shine-border';
import { getAuraBloomImage, hexWithAlpha } from '@/lib/ui/aura-palette';
import { cn } from '@/lib/utils';

type AuraRowBloomProps = {
  color: string;
  /** Settled rows (pagado) get a softer wash so open items stand out. */
  subdued?: boolean;
};

/** Status corner bloom for list rows; needs an `isolate` parent so it stays behind content. */
export const AuraRowBloom = ({ color, subdued = false }: AuraRowBloomProps) => (
  <span
    aria-hidden
    className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit]"
    style={{ backgroundImage: getAuraBloomImage(color, subdued ? 0.45 : 1) }}
  />
);

type AuraSurfaceProps = ComponentPropsWithoutRef<'div'> & {
  /** Hex hue for the bloom, grid squares, border tint, and shine. */
  color: string;
  /** Animated grid squares + shine border. Keep to hero tiles so the page stays calm. */
  animated?: boolean;
  /** Faint grid lines on the face (static unless `animated`). */
  grid?: boolean;
};

/**
 * Card face that shares the wallet strip's language: brand bloom, faint grid,
 * optional shine. Layers on top of the caller's own background/border classes.
 */
export const AuraSurface = ({
  color,
  animated = false,
  grid = true,
  className,
  style,
  children,
  ...props
}: AuraSurfaceProps) => {
  const shouldReduceMotion = useReducedMotion();
  const surfaceStyle: CSSProperties = {
    backgroundImage: getAuraBloomImage(color),
    borderColor: hexWithAlpha(color, 0.3),
    ...style,
  };

  return (
    <div
      className={cn('relative isolate overflow-hidden', className)}
      style={surfaceStyle}
      {...props}
    >
      {grid ? (
        <AnimatedGridPattern
          width={16}
          height={16}
          numSquares={animated && !shouldReduceMotion ? 5 : 0}
          maxOpacity={0.35}
          duration={3}
          repeatDelay={1.5}
          className="-z-10 fill-transparent stroke-foreground/[0.05] [mask-image:linear-gradient(115deg,white_5%,transparent_80%)] dark:stroke-white/[0.05]"
          style={{ color: hexWithAlpha(color, 0.5) }}
        />
      ) : null}
      {animated ? (
        <ShineBorder
          shineColor={[color, hexWithAlpha(color, 0.35)]}
          borderWidth={1}
          duration={12}
        />
      ) : null}
      {children}
    </div>
  );
};
