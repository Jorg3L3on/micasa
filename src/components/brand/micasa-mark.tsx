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
      viewBox="0 0 240 140"
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
      <g transform="translate(20 18)">
        <circle cx="48" cy="102" r="12" fill={`url(#${gradientId})`} />
        <circle cx="82" cy="46" r="12" fill={`url(#${gradientId})`} />
        <circle cx="118" cy="102" r="12" fill={`url(#${gradientId})`} />
        <circle cx="154" cy="46" r="12" fill={`url(#${gradientId})`} />
        <circle cx="190" cy="102" r="12" fill={`url(#${gradientId})`} />
        <path
          d="M48 102 L82 46 L118 102 L154 46 L190 102"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="82"
          y1="24"
          x2="82"
          y2="8"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.55"
        />
        <line
          x1="154"
          y1="24"
          x2="154"
          y2="8"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.55"
        />
        <line
          x1="36"
          y1="34"
          x2="20"
          y2="24"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.55"
        />
        <line
          x1="202"
          y1="34"
          x2="218"
          y2="24"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.55"
        />
      </g>
    </svg>
  );
};
