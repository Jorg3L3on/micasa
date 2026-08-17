'use client';

import { type PointerEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';

import { cn } from '@/lib/utils';

export const Reveal = ({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

type LandingLinkProps = {
  children: ReactNode;
  className?: string;
  href: string;
  variant?: 'primary' | 'ghost' | 'outline';
};

export const LandingLink = ({
  children,
  className,
  href,
  variant = 'primary',
}: LandingLinkProps) => {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 280, damping: 18, mass: 0.35 });
  const springY = useSpring(y, { stiffness: 280, damping: 18, mass: 0.35 });

  const handlePointerMove = (event: PointerEvent<HTMLAnchorElement>) => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * 0.22);
    y.set((event.clientY - rect.top - rect.height / 2) * 0.22);
  };

  const handlePointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div style={{ x: springX, y: springY }} className="inline-flex w-full sm:w-auto">
      <Link
        href={href}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={cn(
          'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-7 text-base font-semibold tracking-tight transition-[transform,box-shadow,background-color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5733]/60 sm:w-auto',
          variant === 'primary' &&
            'landing-cta text-white shadow-[0_12px_40px_-12px_rgba(255,87,51,0.85)] hover:brightness-110',
          variant === 'ghost' &&
            'border border-white/18 bg-white/[0.03] text-white hover:border-white/30 hover:bg-white/[0.07]',
          variant === 'outline' &&
            'border border-white/12 bg-transparent text-white hover:border-white/28 hover:bg-white/[0.05]',
          className
        )}
      >
        {children}
      </Link>
    </motion.div>
  );
};

export const GlassPanel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'rounded-2xl border border-white/[0.08] bg-[#0d1327]/80 shadow-[0_24px_80px_-40px_rgba(58,55,252,0.45)] backdrop-blur-xl',
      className
    )}
  >
    {children}
  </div>
);
