'use client';

import { useEffect, useState } from 'react';
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

/** Count-up for landing mock figures; instant when reduced motion is preferred. */
export const AnimatedAmount = ({
  value,
  className,
  prefix = '$',
  decimals = 2,
  durationMs = 1400,
}: AnimatedAmountProps) => {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(value * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [durationMs, reduceMotion, value]);

  return (
    <span className={className}>
      {prefix}
      {formatAmount(display, decimals)}
    </span>
  );
};
