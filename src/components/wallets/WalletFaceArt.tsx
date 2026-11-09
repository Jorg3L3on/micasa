'use client';

import { motion, useReducedMotion, type MotionValue } from 'framer-motion';
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern';

type WalletFaceArtProps = {
  /** Horizontal drift (px) of the art inside the frame. */
  drift?: MotionValue<number>;
};

/**
 * Art behind every wallet and card face: soft highlight plus an animated grid.
 * The parent must clip it (`overflow-hidden`). Reduced motion keeps the lines
 * and drops the squares.
 */
export const WalletFaceArt = ({ drift }: WalletFaceArtProps) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute -inset-x-[18%] inset-y-0 opacity-35 [background-image:radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.32),transparent_55%)]"
      style={{ x: drift }}
    >
      <AnimatedGridPattern
        width={22}
        height={22}
        numSquares={reduceMotion ? 0 : 14}
        maxOpacity={0.5}
        duration={3}
        className="fill-transparent stroke-white/20 text-white"
      />
    </motion.div>
  );
};
