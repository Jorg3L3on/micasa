import { ImageResponse } from 'next/og';

import {
  MICASA_MARK_PATH,
  MICASA_MARK_STROKE_WIDTH,
  MICASA_MARK_VIEWBOX,
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
          width="112"
          height="98"
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
        </svg>
      </div>
    ),
    {
      ...size,
    },
  );
}
