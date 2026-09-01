import { ImageResponse } from 'next/og';

import {
  MICASA_MARK_NODE_R,
  MICASA_MARK_NODES,
  MICASA_MARK_PATH,
  MICASA_MARK_STROKE_WIDTH,
  MICASA_MARK_VIEWBOX,
} from '@/components/brand/micasa-mark-geometry';

/** Matches the existing 180×180 apple-icon composition. */
const MARK_WIDTH_RATIO = 148 / 180;
const MARK_HEIGHT_RATIO = 84 / 180;
const CORNER_RATIO = 40 / 180;

const ICON_BACKGROUND =
  'radial-gradient(circle at 30% 20%, #3B4256 0%, #1E2433 40%, #111522 100%)';

/**
 * Square app icon: Orion navy wash + rooftop zigzag mark.
 * Used by apple-icon (180) and PWA icons (192 / 512).
 */
export function createMicasaAppIcon(size: number): ImageResponse {
  const markWidth = Math.round(size * MARK_WIDTH_RATIO);
  const markHeight = Math.round(size * MARK_HEIGHT_RATIO);
  const borderRadius = Math.round(size * CORNER_RATIO);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius,
          background: ICON_BACKGROUND,
        }}
      >
        <svg
          width={markWidth}
          height={markHeight}
          viewBox={MICASA_MARK_VIEWBOX}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="micasaGrad"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop stopColor="#6d8bff" />
              <stop offset="0.38" stopColor="#3a37fc" />
              <stop offset="1" stopColor="#ee477a" />
            </linearGradient>
          </defs>
          <path
            d={MICASA_MARK_PATH}
            stroke="url(#micasaGrad)"
            strokeWidth={MICASA_MARK_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {MICASA_MARK_NODES.map(([cx, cy]) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={MICASA_MARK_NODE_R}
              fill="url(#micasaGrad)"
            />
          ))}
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
