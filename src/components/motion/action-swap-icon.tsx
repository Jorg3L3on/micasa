'use client';

import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import type { ReactNode } from 'react';
import { EASE_OUT, SPRING_SWAP } from '@/components/motion/ease';
import { cn } from '@/lib/utils';

type CoreAnimation = 'blur' | 'roll';

const BLUR_TRANSITION = { duration: 0.2, ease: 'easeInOut' } as const;
const ROLL_EXIT_TRANSITION = { duration: 0.14, ease: EASE_OUT } as const;
const SWAP_BLUR = 'blur(8px)';
const ROLL_BLUR = 'blur(3px)';

const ICON_VARIANTS: Record<CoreAnimation, Variants> = {
  blur: {
    initial: { opacity: 0, scale: 0.25, filter: SWAP_BLUR },
    animate: {
      opacity: 1,
      scale: 1,
      filter: 'blur(0px)',
      transition: BLUR_TRANSITION,
    },
    exit: {
      opacity: 0,
      scale: 0.25,
      filter: SWAP_BLUR,
      transition: BLUR_TRANSITION,
    },
  },
  roll: {
    initial: { opacity: 0, y: 12, filter: ROLL_BLUR },
    animate: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: SPRING_SWAP,
    },
    exit: {
      opacity: 0,
      y: -12,
      filter: ROLL_BLUR,
      transition: ROLL_EXIT_TRANSITION,
    },
  },
};

export const ActionSwapIcon = ({
  value,
  children,
  animation = 'blur',
  className,
}: {
  value: string;
  children: ReactNode;
  animation?: 'blur' | 'roll' | 'cascade';
  className?: string;
}) => {
  const reduce = useReducedMotion();
  const coreAnimation: CoreAnimation =
    animation === 'cascade' ? 'roll' : animation;

  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden',
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={`${animation}-${value}`}
          aria-hidden
          variants={ICON_VARIANTS[coreAnimation]}
          initial={reduce ? false : 'initial'}
          animate={
            reduce ? { opacity: 1, filter: 'blur(0px)', scale: 1, y: 0 } : 'animate'
          }
          exit={reduce ? undefined : 'exit'}
          className="col-start-1 row-start-1 inline-flex items-center justify-center will-change-[opacity,filter,transform]"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};
