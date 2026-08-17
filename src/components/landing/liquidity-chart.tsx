'use client';

import { motion, useReducedMotion } from 'framer-motion';

const LINE_PATH =
  'M4 48 C36 34, 62 62, 98 52 C134 42, 168 78, 204 58 C240 38, 274 66, 316 28';
const AREA_PATH = `${LINE_PATH} L316 112 L4 112 Z`;

/** Signature motion: liquidity curve draws when the mock enters view. */
export const LiquidityChart = () => {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="relative h-36 overflow-hidden border border-white/10 bg-black/25 sm:h-40"
      aria-hidden
    >
      <svg viewBox="0 0 320 112" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="landingLiqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#911efe" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#3a37fc" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="landingLiqStroke" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3a37fc" />
            <stop offset="100%" stopColor="#ee477a" />
          </linearGradient>
        </defs>

        {[28, 56, 84].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="320"
            y2={y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}

        <motion.path
          d={AREA_PATH}
          fill="url(#landingLiqFill)"
          initial={reduceMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.9, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.path
          d={LINE_PATH}
          fill="none"
          stroke="url(#landingLiqStroke)"
          strokeWidth="2.75"
          strokeLinecap="round"
          initial={reduceMotion ? false : { pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 1.25, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.g
          initial={reduceMotion ? false : { opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.45, delay: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          <circle cx="180" cy="70" r="5.5" fill="#fbbf24" />
          <circle
            cx="180"
            cy="70"
            r="10"
            fill="none"
            stroke="#fbbf24"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
        </motion.g>
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex justify-between text-[9px] font-medium uppercase tracking-wider text-white/35">
        <span>Hoy</span>
        <span>90d</span>
        <span>180d</span>
      </div>
    </div>
  );
};
