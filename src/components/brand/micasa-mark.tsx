'use client';

import { useId } from 'react';

import {
  MICASA_MARK_GRADIENT_FROM,
  MICASA_MARK_GRADIENT_TO,
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

/** Brand isotipo: filled rounded M, blue to violet, with a light gloss. */
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
        <linearGradient id={fillId} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor={MICASA_MARK_GRADIENT_FROM} />
          <stop offset="100%" stopColor={MICASA_MARK_GRADIENT_TO} />
        </linearGradient>
        <linearGradient id={glossId} x1="78%" y1="0%" x2="100%" y2="28%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.38" />
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
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
