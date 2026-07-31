'use client';

import { motion, useReducedMotion } from 'framer-motion';

/** Soft kinetic mesh for the landing canvas — atmosphere only, not content. */
export const LandingAtmosphere = () => {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#eef3f8]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_10%_-10%,rgba(46,141,245,0.22),transparent_55%),radial-gradient(ellipse_70%_55%_at_95%_5%,rgba(14,165,233,0.14),transparent_50%),radial-gradient(ellipse_60%_45%_at_50%_100%,rgba(16,185,129,0.1),transparent_55%)]" />

      <motion.div
        className="absolute -left-24 top-16 h-[28rem] w-[28rem] rounded-full bg-[#2E8DF5]/15 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 40, -10, 0], y: [0, 24, -16, 0], scale: [1, 1.08, 0.96, 1] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-20 top-40 h-[26rem] w-[26rem] rounded-full bg-sky-400/15 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -30, 20, 0], y: [0, -20, 30, 0], scale: [1, 0.94, 1.06, 1] }
        }
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[22rem] w-[34rem] -translate-x-1/2 rounded-full bg-emerald-400/10 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { opacity: [0.35, 0.55, 0.4, 0.35], scale: [1, 1.05, 1] }
        }
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="absolute inset-0 opacity-[0.4] [background-image:linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_78%)]" />
    </div>
  );
};
