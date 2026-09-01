import { ImageResponse } from 'next/og';

import {
  MICASA_MARK_BAR_PALETTE,
  MICASA_MARK_BARS,
  MICASA_MARK_VIEWBOX,
  getMicasaMarkBarTransform,
  getMicasaMarkCapsuleRect,
} from '@/components/brand/micasa-mark-geometry';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 40,
          background:
            'radial-gradient(circle at 30% 20%, #3B4256 0%, #1E2433 40%, #111522 100%)',
        }}
      >
        <svg
          width="156"
          height="62"
          viewBox={MICASA_MARK_VIEWBOX}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {MICASA_MARK_BARS.map((bar) => {
              const palette = MICASA_MARK_BAR_PALETTE[bar.index];
              if (!palette) return null;
              return (
                <linearGradient
                  key={bar.index}
                  id={`micasaAppleBar-${bar.index}`}
                  x1="0"
                  y1="0"
                  x2="0.12"
                  y2="1"
                >
                  <stop stopColor={palette.highlight} />
                  <stop offset="0.28" stopColor={palette.mid} />
                  <stop offset="1" stopColor={palette.shade} />
                </linearGradient>
              );
            })}
          </defs>
          {MICASA_MARK_BARS.map((bar) => {
            const rect = getMicasaMarkCapsuleRect(bar.length);
            return (
              <rect
                key={bar.index}
                x={rect.x}
                y={rect.y}
                width={rect.width}
                height={rect.height}
                rx={rect.rx}
                transform={getMicasaMarkBarTransform(bar)}
                fill={`url(#micasaAppleBar-${bar.index})`}
              />
            );
          })}
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
