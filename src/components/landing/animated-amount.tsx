'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

type AnimatedAmountProps = {
  value: number;
  className?: string;
  prefix?: string;
  decimals?: number;
  durationMs?: number;
};

const formatAmount = (value: number, decimals: number) =>
  value.toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** Count-up for landing mock figures; shows final value until in view. */
export const AnimatedAmount = ({
  value,
  className,
  prefix = '$',
  decimals = 2,
  durationMs = 1400,
}: AnimatedAmountProps) => {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const hasAnimated = useRef(false);
  const frameRef = useRef(0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    const node = ref.current;
    if (!node || hasAnimated.current) {
      setDisplay(value);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || hasAnimated.current) return;
        hasAnimated.current = true;
        observer.disconnect();

        const start = performance.now();
        setDisplay(0);

        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / durationMs);
          const eased = 1 - (1 - progress) ** 3;
          setDisplay(value * eased);
          if (progress < 1) {
            frameRef.current = requestAnimationFrame(tick);
          }
        };

        frameRef.current = requestAnimationFrame(tick);
      },
      { threshold: 0.35 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameRef.current);
    };
  }, [durationMs, reduceMotion, value]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatAmount(display, decimals)}
    </span>
  );
};
