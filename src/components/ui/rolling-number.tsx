'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { splitRollingChars } from '@/lib/ui/rolling-number';
import { cn } from '@/lib/utils';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const LINE_EM = 1.3;
const ROLL_SPRING = { type: 'spring', stiffness: 220, damping: 26, mass: 0.8 } as const;

const DigitColumn = ({ digit, instant }: { digit: number; instant: boolean }) => (
  <span
    aria-hidden
    className="relative inline-block overflow-hidden align-top"
    style={{ height: `${LINE_EM}em`, lineHeight: `${LINE_EM}em` }}
  >
    <motion.span
      className="flex flex-col"
      // First view rolls up from zero; later values turn the way the number moved.
      initial={{ y: '0em' }}
      animate={{ y: `${-digit * LINE_EM}em` }}
      transition={instant ? { duration: 0 } : ROLL_SPRING}
    >
      {DIGITS.map((d) => (
        <span key={d} style={{ height: `${LINE_EM}em` }}>
          {d}
        </span>
      ))}
    </motion.span>
  </span>
);

type RollingNumberProps = {
  /** Already formatted text, e.g. `$1,234.56`. Digits roll; other characters stay put. */
  text: string;
  className?: string;
};

/** Odometer-style number: digits roll to their new value (after Arc's metric card). */
export const RollingNumber = ({ text, className }: RollingNumberProps) => {
  const reducedMotion = useReducedMotion() ?? false;
  return (
    <span className={cn('inline-flex tabular-nums', className)}>
      <span className="sr-only">{text}</span>
      {splitRollingChars(text).map((column) =>
        column.kind === 'digit' ? (
          <DigitColumn key={column.key} digit={column.digit} instant={reducedMotion} />
        ) : (
          <span
            key={column.key}
            aria-hidden
            className="inline-block whitespace-pre"
            style={{ lineHeight: `${LINE_EM}em` }}
          >
            {column.char}
          </span>
        ),
      )}
    </span>
  );
};

type RollingTextProps = {
  text: string;
  /** Direction of travel: new copy rolls in from this side. */
  direction: 1 | -1;
  className?: string;
};

/** Copy that rolls in from the direction the rail moved; a quick fade for reduced motion. */
export const RollingText = ({ text, direction, className }: RollingTextProps) => {
  const reducedMotion = useReducedMotion() ?? false;
  return (
    <motion.span
      key={text}
      className={cn('inline-block max-w-full truncate align-top', className)}
      initial={{ opacity: 0, x: reducedMotion ? 0 : direction * 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: reducedMotion ? 0.12 : 0.26, ease: [0.16, 1, 0.3, 1] }}
    >
      {text}
    </motion.span>
  );
};
