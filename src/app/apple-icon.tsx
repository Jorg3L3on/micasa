import { ImageResponse } from 'next/og';

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
          width="124"
          height="124"
          viewBox="0 0 220 180"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M26 118 L58 60 L94 118 L130 60 L166 118"
            stroke="url(#micasaGrad)"
            strokeWidth="15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="26" cy="118" r="11" fill="url(#micasaGrad)" />
          <circle cx="58" cy="60" r="11" fill="url(#micasaGrad)" />
          <circle cx="94" cy="118" r="11" fill="url(#micasaGrad)" />
          <circle cx="130" cy="60" r="11" fill="url(#micasaGrad)" />
          <circle cx="166" cy="118" r="11" fill="url(#micasaGrad)" />
          <defs>
            <linearGradient
              id="micasaGrad"
              x1="0"
              y1="0"
              x2="220"
              y2="180"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#2E8DF5" />
              <stop offset="1" stopColor="#AC3DF3" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
