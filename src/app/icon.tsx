import { ImageResponse } from 'next/og';

import {
  MICASA_MARK_NODE_R,
  MICASA_MARK_NODES,
  MICASA_MARK_PATH,
  MICASA_MARK_STROKE_WIDTH,
  MICASA_MARK_VIEWBOX,
} from '@/components/brand/micasa-mark-geometry';

export const size = {
  width: 32,
  height: 32,
};

export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          background:
            'radial-gradient(circle at 30% 20%, #3B4256 0%, #1E2433 40%, #111522 100%)',
        }}
      >
        <svg
          width="26"
          height="15"
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
    {
      ...size,
    },
  );
}
