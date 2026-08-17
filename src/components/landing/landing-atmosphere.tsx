'use client';

import { motion, useReducedMotion } from 'framer-motion';

/** Kinetic mesh for the Orion dark canvas — atmosphere only, not content. */
export const LandingAtmosphere = () => {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#060914]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_15%_-10%,rgba(58,55,252,0.28),transparent_55%),radial-gradient(ellipse_70%_50%_at_95%_0%,rgba(238,71,122,0.18),transparent_50%),radial-gradient(ellipse_55%_40%_at_50%_100%,rgba(145,30,254,0.16),transparent_55%)]" />

      <motion.div
        className="absolute -left-24 top-10 h-[30rem] w-[30rem] rounded-full bg-[#3a37fc]/25 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, 36, -12, 0], y: [0, 22, -18, 0], scale: [1, 1.08, 0.96, 1] }
        }
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -right-16 top-32 h-[28rem] w-[28rem] rounded-full bg-[#ee477a]/18 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { x: [0, -28, 18, 0], y: [0, -18, 26, 0], scale: [1, 0.94, 1.06, 1] }
        }
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-0 left-1/3 h-[22rem] w-[34rem] -translate-x-1/2 rounded-full bg-[#911efe]/14 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { opacity: [0.3, 0.55, 0.38, 0.3], scale: [1, 1.06, 1] }
        }
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-1/4 top-[40%] h-64 w-64 rounded-full bg-[#ff5733]/10 blur-3xl"
        animate={
          reduceMotion ? undefined : { opacity: [0.2, 0.4, 0.2], x: [0, 20, 0] }
        }
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="absolute inset-0 opacity-[0.28] [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_22%,transparent_78%)]" />
    </div>
  );
};
