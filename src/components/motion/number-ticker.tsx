'use client';

import { animate, motion, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef } from 'react';
import { cn, formatCurrency, toDisplayAmount } from '@/lib/utils';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export type NumberTickerProps = {
  value: number;
  /** Digits to pad to (left). */
  pad?: number;
  /** Per-digit roll duration in seconds. */
  duration?: number;
  /** Stagger between digits. Live updates should stay at 0 so the roll does not feel late. */
  stagger?: number;
  /** Render only after the element enters the viewport. */
  startOnView?: boolean;
  prefix?: string;
  suffix?: string;
  /** Add a small blur during digit rolls. */
  blur?: boolean;
  className?: string;
  digitClassName?: string;
  /** Insert locale group separators. */
  locale?: boolean;
  /** Custom formatter. Receives the original value so currency cents are kept. */
  format?: (value: number) => string;
};

const DIGIT_HEIGHT_EM = 1.1;
const DIGITS = Array.from({ length: 10 }, (_, n) => n);

export const formatNumberTickerText = (
  value: number,
  options: {
    pad?: number;
    locale?: boolean;
    format?: (value: number) => string;
  },
): string => {
  const formatted = options.format
    ? options.format(value)
    : options.locale
      ? Math.round(value).toLocaleString('es-MX')
      : Math.round(value).toString();
  return options.pad ? formatted.padStart(options.pad, '0') : formatted;
};

export const NumberTicker = ({
  value,
  pad,
  duration = 0.45,
  stagger = 0,
  startOnView = false,
  prefix,
  suffix,
  blur = false,
  className,
  digitClassName,
  locale,
  format,
}: NumberTickerProps) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const inView = useInView(containerRef, { once: true, amount: 0.6 });
  const armed = !startOnView || inView;

  const text = useMemo(
    () => formatNumberTickerText(value, { pad, locale, format }),
    [value, pad, format, locale],
  );
  const glyphs = useMemo(() => {
    const chars = text.split('');
    return chars.map((char, index) => ({
      char,
      id: `g-${chars.length - 1 - index}`,
    }));
  }, [text]);
  const readableText = `${prefix ?? ''}${text}${suffix ?? ''}`;

  return (
    <span
      ref={containerRef}
      className={cn('inline-flex items-center tabular-nums', className)}
    >
      <span className="sr-only">{readableText}</span>
      <span aria-hidden="true" className="inline-flex items-center">
        {prefix ? <span>{prefix}</span> : null}
        {glyphs.map(({ char, id }, index) => {
          if (!/\d/.test(char)) {
            return (
              <span key={id} className="inline-block">
                {char}
              </span>
            );
          }
          return (
            <Digit
              key={id}
              digit={armed ? Number(char) : 0}
              delay={index * stagger}
              duration={duration}
              blur={blur}
              className={digitClassName}
            />
          );
        })}
        {suffix ? <span>{suffix}</span> : null}
      </span>
    </span>
  );
};

const Digit = ({
  digit,
  delay,
  duration,
  blur,
  className,
}: {
  digit: number;
  delay: number;
  duration: number;
  blur: boolean;
  className?: string;
}) => {
  const reduce = useReducedMotion();
  const columnRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduce || !blur || !columnRef.current || !Number.isFinite(digit)) {
      return;
    }

    const node = columnRef.current;
    const controls = animate(
      node,
      { filter: ['blur(10px)', 'blur(0px)'] },
      {
        duration: Math.min(duration * 0.75, 0.32),
        delay,
        ease: EASE_OUT,
      },
    );

    return () => {
      controls.stop();
      node.style.filter = 'blur(0px)';
    };
  }, [blur, delay, digit, duration, reduce]);

  return (
    <span
      className={cn('relative inline-block overflow-hidden', className)}
      style={{ height: `${DIGIT_HEIGHT_EM}em`, width: '1ch' }}
    >
      <motion.span
        ref={columnRef}
        initial={false}
        animate={{ y: `-${digit * DIGIT_HEIGHT_EM}em` }}
        transition={
          reduce ? { duration: 0 } : { duration, delay, ease: EASE_OUT }
        }
        className="absolute inset-x-0 top-0 flex flex-col items-center will-change-transform"
      >
        {DIGITS.map((n) => (
          <span
            key={n}
            className="flex items-center justify-center leading-none"
            style={{ height: `${DIGIT_HEIGHT_EM}em` }}
          >
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
};

type CurrencyTickerProps = {
  value: number;
  className?: string;
};

/** Panel money figure. Shows the current amount immediately and rolls when it changes. */
export const CurrencyTicker = ({ value, className }: CurrencyTickerProps) => (
  <NumberTicker
    value={toDisplayAmount(value)}
    format={formatCurrency}
    startOnView={false}
    duration={0.4}
    stagger={0}
    className={cn('font-mono tabular-nums', className)}
  />
);
