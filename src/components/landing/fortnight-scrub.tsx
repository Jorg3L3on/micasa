'use client';

import { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';

import { cn } from '@/lib/utils';

const FIRST = {
  label: '1–15',
  title: 'Primera quincena',
  balance: 3370,
  paid: 58,
  income: [
    { name: 'Nómina', amount: '+$12,000' },
    { name: 'Freelance', amount: '+$3,500' },
  ],
  expenses: [
    { name: 'Renta', amount: '-$8,500', paid: true },
    { name: 'Despensa', amount: '-$2,180', paid: false },
    { name: 'Tarjeta', amount: '-$1,450', paid: false },
  ],
} as const;

const SECOND = {
  label: '16–31',
  title: 'Segunda quincena',
  balance: 2140,
  paid: 41,
  income: [
    { name: 'Nómina', amount: '+$12,000' },
    { name: 'Extra', amount: '+$800' },
  ],
  expenses: [
    { name: 'Colegiatura', amount: '-$4,200', paid: true },
    { name: 'Gas', amount: '-$980', paid: false },
    { name: 'Préstamo', amount: '-$2,500', paid: false },
  ],
} as const;

const formatMoney = (value: number) =>
  `$${value.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Signature landing interaction: scroll scrubs between fortnight periods. */
export const FortnightScrub = () => {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const rawProgress = useTransform(scrollYProgress, [0.15, 0.75], [0, 1]);
  const progress = useSpring(rawProgress, {
    stiffness: 90,
    damping: 24,
    mass: 0.4,
  });

  const balanceMv = useMotionValue(FIRST.balance);
  const paidMv = useMotionValue(FIRST.paid);
  const balanceText = useTransform(balanceMv, (v) => formatMoney(Math.round(v)));
  const paidText = useTransform(paidMv, (v) => `${Math.round(v)}%`);
  const paidWidth = useTransform(paidMv, (v) => `${v}%`);
  const pendingWidth = useTransform(paidMv, (v) => `${100 - v}%`);
  const trackWidth = useTransform(progress, (v) => `${v * 100}%`);
  const firstOpacity = useTransform(progress, [0, 0.45, 1], [1, 0.35, 0.2]);
  const secondOpacity = useTransform(progress, [0, 0.55, 1], [0.2, 0.45, 1]);
  const panelX = useTransform(progress, [0, 1], reduceMotion ? [0, 0] : [0, -18]);

  useMotionValueEvent(progress, 'change', (latest) => {
    const t = reduceMotion ? 0 : latest;
    balanceMv.set(
      Number(FIRST.balance) + (Number(SECOND.balance) - Number(FIRST.balance)) * t
    );
    paidMv.set(Number(FIRST.paid) + (Number(SECOND.paid) - Number(FIRST.paid)) * t);
  });

  return (
    <section
      ref={sectionRef}
      className="relative z-10 border-t border-[#0b1220]/8 py-20 md:py-28"
      aria-labelledby="quincena-scrub-heading"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2E8DF5]">
            El ritmo MiCasa
          </p>
          <h2
            id="quincena-scrub-heading"
            className="mt-3 font-[family-name:var(--font-landing-display)] text-3xl font-semibold tracking-[-0.03em] text-[#0b1220] sm:text-4xl md:text-[2.75rem]"
          >
            Desliza el mes: dos quincenas, una claridad
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[#0b1220]/55">
            Al hacer scroll, el plan se mueve del 1–15 al 16–fin. Así se ve el dinero
            cuando cobras dos veces al mes.
          </p>
        </div>

        <div className="mt-10 flex items-center gap-3" aria-hidden>
          <motion.span
            style={{ opacity: firstOpacity }}
            className="font-[family-name:var(--font-landing-display)] text-sm font-semibold text-[#0b1220]"
          >
            {FIRST.label}
          </motion.span>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#0b1220]/10">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-[#2E8DF5]"
              style={{ width: trackWidth }}
            />
          </div>
          <motion.span
            style={{ opacity: secondOpacity }}
            className="font-[family-name:var(--font-landing-display)] text-sm font-semibold text-[#0b1220]"
          >
            {SECOND.label}
          </motion.span>
        </div>

        <motion.div
          className="mt-8 overflow-hidden border border-[#0b1220]/10 bg-[#0e1118] text-white"
          style={{ x: panelX }}
          role="img"
          aria-label="Comparación animada entre primera y segunda quincena"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 sm:px-8">
            <div className="flex items-center gap-3">
              <motion.span
                style={{ opacity: firstOpacity }}
                className="text-xs font-medium text-white/70"
              >
                {FIRST.title}
              </motion.span>
              <span className="text-white/25">→</span>
              <motion.span
                style={{ opacity: secondOpacity }}
                className="text-xs font-medium text-white/70"
              >
                {SECOND.title}
              </motion.span>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/40">
                Pagado
              </p>
              <motion.p className="font-mono text-sm font-semibold tabular-nums text-white">
                {paidText}
              </motion.p>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="border-b border-white/10 p-5 sm:p-8 lg:border-b-0 lg:border-r">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Balance quincena
              </p>
              <motion.p className="mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight text-emerald-400 sm:text-4xl">
                {balanceText}
              </motion.p>
              <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div className="h-full bg-emerald-500" style={{ width: paidWidth }} />
                <motion.div className="h-full bg-amber-400" style={{ width: pendingWidth }} />
              </div>
            </div>

            <div className="relative grid gap-0 sm:grid-cols-2">
              <PeriodColumn
                progress={progress}
                invert
                income={FIRST.income}
                expenses={FIRST.expenses}
                className="border-b border-white/10 sm:border-b-0 sm:border-r"
              />
              <PeriodColumn
                progress={progress}
                income={SECOND.income}
                expenses={SECOND.expenses}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const PeriodColumn = ({
  progress,
  income,
  expenses,
  invert = false,
  className,
}: {
  progress: MotionValue<number>;
  income: readonly { name: string; amount: string }[];
  expenses: readonly { name: string; amount: string; paid: boolean }[];
  invert?: boolean;
  className?: string;
}) => {
  const opacity = useTransform(progress, [0, 1], invert ? [1, 0.28] : [0.28, 1]);

  return (
    <motion.div style={{ opacity }} className={cn('space-y-4 p-5 sm:p-6', className)}>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/80">
          Ingresos
        </p>
        {income.map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between border border-white/[0.06] bg-white/[0.03] px-3 py-2"
          >
            <span className="text-xs text-white/75">{row.name}</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-emerald-400">
              {row.amount}
            </span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
          Gastos
        </p>
        {expenses.map((row) => (
          <div
            key={row.name}
            className={cn(
              'flex items-center justify-between border border-white/[0.06] px-3 py-2',
              row.paid ? 'bg-white/[0.02] opacity-70' : 'bg-white/[0.03]'
            )}
          >
            <span className="text-xs text-white/75">{row.name}</span>
            <span className="font-mono text-xs font-semibold tabular-nums text-white/85">
              {row.amount}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
