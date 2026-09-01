'use client';

import { useRef } from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'framer-motion';

import { cn } from '@/lib/utils';

type Line = { name: string; amount: string; paid?: boolean };

type Period = {
  label: string;
  title: string;
  balance: number;
  paid: number;
  income: readonly Line[];
  expenses: readonly Line[];
};

const FIRST: Period = {
  label: 'Último–14',
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
};

const SECOND: Period = {
  label: '15–penúltimo',
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
};

const formatMoney = (value: number) =>
  `$${value.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Signature landing interaction: pinned scroll scrubs between fortnight periods. */
export const FortnightScrub = () => {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  });

  const progress = useTransform(scrollYProgress, (latest) => {
    if (reduceMotion) return latest > 0.45 ? 1 : 0;
    // Map most of the pin distance into a full 0→1 morph
    const start = 0.06;
    const end = 0.62;
    if (latest <= start) return 0;
    if (latest >= end) return 1;
    return (latest - start) / (end - start);
  });

  const balanceText = useTransform(progress, (t) =>
    formatMoney(Math.round(FIRST.balance + (SECOND.balance - FIRST.balance) * t))
  );
  const paidText = useTransform(progress, (t) =>
    `${Math.round(FIRST.paid + (SECOND.paid - FIRST.paid) * t)}%`
  );
  const paidWidth = useTransform(
    progress,
    (t) => `${FIRST.paid + (SECOND.paid - FIRST.paid) * t}%`
  );
  const pendingWidth = useTransform(
    progress,
    (t) => `${100 - (FIRST.paid + (SECOND.paid - FIRST.paid) * t)}%`
  );
  const trackWidth = useTransform(progress, (t) => `${t * 100}%`);
  const firstOpacity = useTransform(progress, [0, 0.45, 1], [1, 0.35, 0.2]);
  const secondOpacity = useTransform(progress, [0, 0.55, 1], [0.2, 0.5, 1]);
  const firstListOpacity = useTransform(progress, [0, 0.38], [1, 0]);
  const secondListOpacity = useTransform(progress, [0.32, 0.7], [0, 1]);
  const activeLabel = useTransform(progress, (t) =>
    t < 0.5 ? FIRST.title : SECOND.title
  );

  return (
    <section
      ref={sectionRef}
      className="relative z-10 h-[160vh] border-t border-white/[0.06] md:h-[180vh]"
      aria-labelledby="quincena-scrub-heading"
    >
      {/*
        Exact viewport pin + overflow-hidden (not overflow-y-auto): page scroll
        drives the scrub. Nested overflow-y-auto/overscroll-contain trapped wheel.
      */}
      <div className="sticky top-[3.75rem] flex h-[calc(100svh-3.75rem)] items-center overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-5 py-4 sm:px-6 sm:py-6 md:px-8 md:py-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#911efe]">
              El ritmo MiCasa
            </p>
            <h2
              id="quincena-scrub-heading"
              className="mt-2 font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-[-0.03em] text-white sm:mt-3 sm:text-4xl md:text-[2.6rem]"
            >
              Desliza el mes: dos quincenas, una claridad
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/50 sm:mt-3 sm:text-base">
              Sigue bajando — el balance y los gastos cruzan del último día al 14, y del 15 al penúltimo.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-3 sm:mt-5" aria-hidden>
            <motion.span
              style={{ opacity: firstOpacity }}
              className="font-[family-name:var(--font-landing-display)] text-sm font-semibold text-white"
            >
              {FIRST.label}
            </motion.span>
            <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-[#3a37fc] to-[#ee477a]"
                style={{ width: trackWidth }}
              />
            </div>
            <motion.span
              style={{ opacity: secondOpacity }}
              className="font-[family-name:var(--font-landing-display)] text-sm font-semibold text-white"
            >
              {SECOND.label}
            </motion.span>
          </div>

          <div
            className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0d1327] text-white shadow-[0_24px_80px_-40px_rgba(58,55,252,0.55)]"
            role="img"
            aria-label="Comparación animada entre primera y segunda quincena"
            data-scrub-panel
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 sm:px-8">
              <motion.span
                className="text-xs font-medium text-white/70"
                data-scrub-title
              >
                {activeLabel}
              </motion.span>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  Pagado
                </p>
                <motion.p
                  className="font-mono text-sm font-semibold tabular-nums text-white"
                  data-scrub-paid
                >
                  {paidText}
                </motion.p>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="border-b border-white/10 p-4 sm:p-7 lg:border-b-0 lg:border-r">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Balance quincena
                </p>
                <motion.p
                  className="mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight text-emerald-400 sm:text-4xl"
                  data-scrub-balance
                >
                  {balanceText}
                </motion.p>
                <div className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full bg-emerald-500"
                    style={{ width: paidWidth }}
                  />
                  <motion.div
                    className="h-full bg-amber-400"
                    style={{ width: pendingWidth }}
                  />
                </div>
              </div>

              <div className="relative min-h-[11.5rem] p-4 sm:min-h-[14.5rem] sm:p-6">
                <PeriodLists
                  period={FIRST}
                  opacity={firstListOpacity}
                  className="absolute inset-0 p-4 sm:p-6"
                />
                <PeriodLists
                  period={SECOND}
                  opacity={secondListOpacity}
                  className="absolute inset-0 p-4 sm:p-6"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const PeriodLists = ({
  period,
  opacity,
  className,
}: {
  period: Period;
  opacity: MotionValue<number>;
  className?: string;
}) => (
  <motion.div
    style={{ opacity }}
    className={cn('grid gap-4 sm:grid-cols-2', className)}
  >
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/80">
        Ingresos
      </p>
      {period.income.map((row) => (
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
      {period.expenses.map((row) => (
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
