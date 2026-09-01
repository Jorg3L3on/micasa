'use client';

import { useId } from 'react';

import {
  MICASA_MARK_NODE_R,
  MICASA_MARK_NODES,
  MICASA_MARK_PATH,
  MICASA_MARK_STROKE_WIDTH,
  MICASA_MARK_VIEWBOX,
} from '@/components/brand/micasa-mark-geometry';
import { cn } from '@/lib/utils';

type MicasaMarkProps = {
  className?: string;
  /** Accessible name when the mark stands alone. Omit when adjacent text labels it. */
  title?: string;
};

/** Brand isotipo: rooftop zigzag with round nodes, Zigzag/Workia gradient + gloss. */
export const MicasaMark = ({ className, title }: MicasaMarkProps) => {
  const reactId = useId();
  const uid = reactId.replace(/:/g, '');
  const fillId = `micasaMarkFill-${uid}`;
  const glossId = `micasaMarkGloss-${uid}`;
  const isDecorative = !title;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={MICASA_MARK_VIEWBOX}
      role={isDecorative ? undefined : 'img'}
      aria-hidden={isDecorative ? true : undefined}
      className={cn('shrink-0', className)}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={fillId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6d8bff" />
          <stop offset="38%" stopColor="#3a37fc" />
          <stop offset="100%" stopColor="#ee477a" />
        </linearGradient>
        <linearGradient id={glossId} x1="0%" y1="0%" x2="55%" y2="90%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="42%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={MICASA_MARK_PATH}
        fill="none"
        stroke={`url(#${fillId})`}
        strokeWidth={MICASA_MARK_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {MICASA_MARK_NODES.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={MICASA_MARK_NODE_R} fill={`url(#${fillId})`} />
      ))}
      <path
        d={MICASA_MARK_PATH}
        fill="none"
        stroke={`url(#${glossId})`}
        strokeWidth={MICASA_MARK_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
