'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE_OUT } from '@/components/motion/ease';

/** Delay stops growing here, so a long list reveals as fast as a short one. */
const MAX_STAGGER_STEPS = 4;
const STAGGER_S = 0.02;
const DURATION_S = 0.24;

type RevealGroupProps = {
  children: ReactNode;
  /** False holds the items hidden; true reveals them. */
  active?: boolean;
  className?: string;
};

/** Parent of `RevealItem`s. Stays within the 320ms operate motion limit. */
export const RevealGroup = ({
  children,
  active = true,
  className,
}: RevealGroupProps) => (
  <motion.div
    initial="hidden"
    animate={active ? 'shown' : 'hidden'}
    className={className}
  >
    {children}
  </motion.div>
);

type RevealItemProps = {
  children?: ReactNode;
  /** Position in the group; sets the stagger delay. */
  index?: number;
  className?: string;
};

/** Rises and fades in with its `RevealGroup`. Reduced motion shows it at once. */
export const RevealItem = ({ children, index = 0, className }: RevealItemProps) => {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: reduce ? 0 : 8 },
        shown: {
          opacity: 1,
          y: 0,
          transition: reduce
            ? { duration: 0 }
            : {
                duration: DURATION_S,
                ease: EASE_OUT,
                delay: Math.min(index, MAX_STAGGER_STEPS) * STAGGER_S,
              },
        },
      }}
    >
      {children}
    </motion.div>
  );
};
