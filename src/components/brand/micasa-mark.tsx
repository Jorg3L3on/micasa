'use client';

import { useId, type SVGProps } from 'react';

import {
  MICASA_MARK_BAR_PALETTE,
  MICASA_MARK_BARS,
  MICASA_MARK_SIZE,
  MICASA_MARK_VIEWBOX,
  getMicasaMarkBarTransform,
  getMicasaMarkCapsuleRect,
} from '@/components/brand/micasa-mark-geometry';
import { cn } from '@/lib/utils';

type MicasaMarkProps = {
  className?: string;
  /** Accessible name when the mark stands alone. Omit when adjacent text labels it. */
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'xmlns' | 'children'>;

/** Rooftop zigzag in the Zigzag Z / Workia W ribbon language. */
export const MicasaMark = ({ className, title, ...svgProps }: MicasaMarkProps) => {
  const reactId = useId();
  const uid = reactId.replace(/:/g, '');
  const glossId = `micasaMarkGloss-${uid}`;
  const clipId = `micasaMarkClip-${uid}`;
  const isDecorative = !title;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={MICASA_MARK_VIEWBOX}
      role={isDecorative ? undefined : 'img'}
      aria-hidden={isDecorative ? true : undefined}
      {...svgProps}
      className={cn('shrink-0', className)}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        {MICASA_MARK_BARS.map((bar) => {
          const palette = MICASA_MARK_BAR_PALETTE[bar.index];
          if (!palette) return null;
          return (
            <linearGradient
              key={bar.index}
              id={`micasaBarLit-${uid}-${bar.index}`}
              x1="0"
              y1="0"
              x2="0.12"
              y2="1"
            >
              <stop offset="0%" stopColor={palette.highlight} />
              <stop offset="28%" stopColor={palette.mid} />
              <stop offset="100%" stopColor={palette.shade} />
            </linearGradient>
          );
        })}
        <linearGradient id={glossId} x1="12%" y1="0%" x2="78%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="36%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clipId}>
          {MICASA_MARK_BARS.map((bar) => (
            <rect
              key={bar.index}
              {...getMicasaMarkCapsuleRect(bar.length)}
              transform={getMicasaMarkBarTransform(bar)}
            />
          ))}
        </clipPath>
      </defs>
      {MICASA_MARK_BARS.map((bar) => (
        <rect
          key={bar.index}
          {...getMicasaMarkCapsuleRect(bar.length)}
          transform={getMicasaMarkBarTransform(bar)}
          fill={`url(#micasaBarLit-${uid}-${bar.index})`}
        />
      ))}
      <rect
        x="0"
        y="0"
        width={MICASA_MARK_SIZE.width}
        height={MICASA_MARK_SIZE.height}
        fill={`url(#${glossId})`}
        clipPath={`url(#${clipId})`}
        pointerEvents="none"
      />
    </svg>
  );
};
