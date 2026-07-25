'use client';

import { useId } from 'react';

import { cn } from '@/lib/utils';

type MicasaMarkProps = {
  className?: string;
  /** Accessible name when the mark stands alone. Omit when adjacent text labels it. */
  title?: string;
};

/** Brand isotipo: connected nodes in blue→violet gradient. */
export const MicasaMark = ({ className, title }: MicasaMarkProps) => {
  const reactId = useId();
  const gradientId = `micasaMarkGradient-${reactId.replace(/:/g, '')}`;
  const isDecorative = !title;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="12 0 216 120"
      role={isDecorative ? undefined : 'img'}
      aria-hidden={isDecorative ? true : undefined}
      className={cn('shrink-0', className)}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2E8DF5" />
          <stop offset="100%" stopColor="#AC3DF3" />
        </linearGradient>
      </defs>
      <g transform="translate(0 2)">
        <circle cx="48" cy="90" r="13" fill={`url(#${gradientId})`} />
        <circle cx="82" cy="38" r="13" fill={`url(#${gradientId})`} />
        <circle cx="118" cy="90" r="13" fill={`url(#${gradientId})`} />
        <circle cx="154" cy="38" r="13" fill={`url(#${gradientId})`} />
        <circle cx="190" cy="90" r="13" fill={`url(#${gradientId})`} />
        <path
          d="M48 90 L82 38 L118 90 L154 38 L190 90"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="82"
          y1="18"
          x2="82"
          y2="4"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.55"
        />
        <line
          x1="154"
          y1="18"
          x2="154"
          y2="4"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.55"
        />
        <line
          x1="36"
          y1="28"
          x2="20"
          y2="18"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.55"
        />
        <line
          x1="202"
          y1="28"
          x2="218"
          y2="18"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.55"
        />
      </g>
    </svg>
  );
};
