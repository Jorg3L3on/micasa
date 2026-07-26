'use client';

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { MicasaMark } from '@/components/brand/micasa-mark';
import { FortnightScrub } from '@/components/landing/fortnight-scrub';
import { LandingAtmosphere } from '@/components/landing/landing-atmosphere';
import { ProductMock } from '@/components/landing/product-mocks';
import { cn } from '@/lib/utils';

const STEPS = [
  {
    n: '01',
    title: 'Arma la quincena',
    body: 'Ingresos y gastos en periodos 1–15 y 16–fin de mes — el ritmo real de cobrar en México.',
  },
  {
    n: '02',
    title: 'Sigue cada salida',
    body: 'Efectivo, débito, crédito, estados de cuenta y cuotas sin perder el hilo del flujo de caja.',
  },
  {
    n: '03',
    title: 'Solo o en casa',
    body: 'Finanzas personales o compartidas: un solo lugar para la quincena de todos.',
  },
] as const;

const HEADLINE_WORDS = ['Tu', 'quincena,', 'clara', 'de', 'punta', 'a', 'punta.'];

const MagneticLink = ({
  children,
  className,
  href,
  variant = 'primary',
}: {
  children: ReactNode;
  className?: string;
  href: string;
  variant?: 'primary' | 'secondary';
}) => {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 280, damping: 18, mass: 0.35 });
  const springY = useSpring(y, { stiffness: 280, damping: 18, mass: 0.35 });

  const handlePointerMove = (event: PointerEvent<HTMLAnchorElement>) => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * 0.28);
    y.set((event.clientY - rect.top - rect.height / 2) * 0.28);
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
          'inline-flex h-12 w-full items-center justify-center gap-2 rounded-md px-7 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8DF5]/50 sm:w-auto',
          variant === 'primary' && 'bg-[#0b1220] text-white hover:bg-[#152038]',
          variant === 'secondary' &&
            'border border-[#0b1220]/15 bg-white/55 text-[#0b1220] backdrop-blur-sm hover:border-[#0b1220]/25 hover:bg-white/85',
          className
        )}
      >
        {children}
      </Link>
    </motion.div>
  );
};

const Reveal = ({
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

export const LandingPage = () => {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const spotlightX = useMotionValue(50);
  const spotlightY = useMotionValue(28);
  const smoothSpotX = useSpring(spotlightX, { stiffness: 60, damping: 20 });
  const smoothSpotY = useSpring(spotlightY, { stiffness: 60, damping: 20 });
  const spotlight = useMotionTemplate`radial-gradient(520px circle at ${smoothSpotX}% ${smoothSpotY}%, rgba(46,141,245,0.16), transparent 58%)`;
  const [headerSolid, setHeaderSolid] = useState(false);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const { scrollY } = useScroll();

  useEffect(() => {
    return scrollY.on('change', (value) => {
      setHeaderSolid(value > 24);
    });
  }, [scrollY]);

  const productY = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [0, 80]
  );
  const productScale = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [1, 1] : [1, 1.03]
  );
  const productRotate = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [1.1, -0.6]
  );
  const productTransform = useMotionTemplate`translate3d(0, ${productY}px, 0) scale(${productScale}) rotateX(${productRotate}deg)`;

  const handleHeroPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    spotlightX.set(((event.clientX - rect.left) / rect.width) * 100);
    spotlightY.set(((event.clientY - rect.top) / rect.height) * 100);
  };

  return (
    <div
      className={cn(
        'relative min-h-svh overflow-x-hidden bg-[#eef3f8] text-[#0b1220]',
        'font-[family-name:var(--font-landing-sans)]'
      )}
    >
      <LandingAtmosphere />

      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.03] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <header
        className={cn(
          'sticky top-0 z-30 transition-[background-color,border-color,backdrop-filter] duration-300',
          headerSolid
            ? 'border-b border-[#0b1220]/8 bg-[#eef3f8]/80 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6 md:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-[#0b1220] transition-opacity hover:opacity-80"
            aria-label="MiCasa inicio"
          >
            <MicasaMark className="h-7 w-auto sm:h-8" />
            <span className="font-[family-name:var(--font-landing-display)] text-base font-semibold tracking-tight sm:text-lg">
              MiCasa
            </span>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-3" aria-label="Acceso">
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-md px-2.5 text-sm font-medium text-[#0b1220]/70 transition-colors hover:bg-[#0b1220]/5 hover:text-[#0b1220] sm:px-3"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center rounded-md bg-[#0b1220] px-3 text-sm font-medium text-white transition-colors hover:bg-[#152038] sm:px-4"
            >
              Crear cuenta
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section
          ref={heroRef}
          onPointerMove={handleHeroPointerMove}
          className="relative z-10 flex min-h-[calc(100svh-3.75rem)] flex-col"
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{ background: spotlight }}
          />

          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-end px-5 pb-6 pt-4 sm:justify-center sm:px-6 sm:pb-8 sm:pt-6 md:px-8 md:pb-10">
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                show: {
                  transition: { staggerChildren: reduceMotion ? 0 : 0.07 },
                },
              }}
              className="relative max-w-3xl"
            >
              <motion.p
                variants={{
                  hidden: { opacity: 0, y: reduceMotion ? 0 : 24 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className="font-[family-name:var(--font-landing-display)] text-[clamp(3.25rem,12vw,8rem)] font-bold leading-[0.9] tracking-[-0.045em] text-[#0b1220]"
              >
                <motion.span
                  className="inline-block bg-[linear-gradient(115deg,#0b1220_10%,#2E8DF5_50%,#0891b2_90%)] bg-[length:220%_100%] bg-clip-text text-transparent"
                  animate={
                    reduceMotion
                      ? undefined
                      : { backgroundPositionX: ['0%', '100%', '0%'] }
                  }
                  transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                >
                  MiCasa
                </motion.span>
              </motion.p>

              <h1 className="mt-5 max-w-2xl text-balance font-[family-name:var(--font-landing-display)] text-[clamp(1.65rem,4.4vw,3.25rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-[#0b1220] sm:mt-7">
                {HEADLINE_WORDS.map((word, index) => (
                  <motion.span
                    key={`${word}-${index}`}
                    className="mr-[0.28em] inline-block last:mr-0"
                    variants={{
                      hidden: {
                        opacity: 0,
                        y: reduceMotion ? 0 : 18,
                      },
                      show: { opacity: 1, y: 0 },
                    }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {word}
                  </motion.span>
                ))}
              </h1>

              <motion.p
                variants={{
                  hidden: { opacity: 0, y: reduceMotion ? 0 : 14 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="mt-4 max-w-md text-pretty text-[0.95rem] leading-relaxed text-[#0b1220]/58 sm:mt-5 sm:text-lg"
              >
                Planifica ingresos, gastos y obligaciones por quincenas — el ritmo
                real de cobrar y pagar en México.
              </motion.p>

              <motion.div
                variants={{
                  hidden: { opacity: 0, y: reduceMotion ? 0 : 14 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="mt-7 flex w-full flex-col gap-3 sm:mt-9 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center"
              >
                <MagneticLink href="/register" variant="primary">
                  Empezar gratis
                  <ArrowRight className="size-4" aria-hidden />
                </MagneticLink>
                <MagneticLink href="/login" variant="secondary">
                  Ya tengo cuenta
                </MagneticLink>
              </motion.div>
            </motion.div>
          </div>

          <div className="relative z-0 mt-2 w-full sm:mt-auto [perspective:1600px]">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.95, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="origin-bottom will-change-transform"
                style={{
                  transform: productTransform,
                  transformStyle: 'preserve-3d',
                }}
              >
                <div className="relative left-1/2 w-[min(148vw,94rem)] -translate-x-1/2">
                  <ProductMock variant="hero" />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <FortnightScrub />

        <section
          id="producto"
          className="relative z-10 border-t border-[#0b1220]/8 py-20 md:py-28"
          aria-labelledby="producto-heading"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
            <Reveal>
              <h2
                id="producto-heading"
                className="max-w-2xl font-[family-name:var(--font-landing-display)] text-3xl font-semibold tracking-[-0.03em] text-[#0b1220] sm:text-4xl md:text-[2.75rem]"
              >
                Del plan al flujo real
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[#0b1220]/55">
                Cada superficie cuenta una historia distinta: hacia dónde va tu
                efectivo, y qué deuda ya está en el horizonte.
              </p>
            </Reveal>

            <div className="mt-14 space-y-16 md:space-y-24">
              <Reveal>
                <div className="grid items-end gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
                  <div className="max-w-md">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2E8DF5]">
                      Liquidez
                    </p>
                    <h3 className="mt-3 font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight text-[#0b1220] sm:text-3xl">
                      Ve el valle antes de llegar a él
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#0b1220]/55 sm:text-base">
                      Proyección a 180 días con nómina, gastos recurrentes, tarjetas
                      y préstamos — para saber cuándo apretar y cuándo sobra.
                    </p>
                  </div>
                  <ProductMock variant="liquidity" />
                </div>
              </Reveal>

              <Reveal delay={0.06}>
                <div className="grid items-end gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
                  <div className="order-2 lg:order-1">
                    <ProductMock variant="cards" />
                  </div>
                  <div className="order-1 max-w-md lg:order-2 lg:justify-self-end">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2E8DF5]">
                      Crédito
                    </p>
                    <h3 className="mt-3 font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight text-[#0b1220] sm:text-3xl">
                      Cortes y cuotas sin sorpresas
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[#0b1220]/55 sm:text-base">
                      Mercado Pago, DiDi y más: usado, mínimo y cuotas activas en el
                      mismo ritmo quincenal.
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        <section
          className="relative z-10 border-t border-[#0b1220]/8 py-20 md:py-28"
          aria-labelledby="pasos-heading"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
            <Reveal>
              <h2
                id="pasos-heading"
                className="font-[family-name:var(--font-landing-display)] text-3xl font-semibold tracking-[-0.03em] text-[#0b1220] sm:text-4xl md:text-[2.75rem]"
              >
                Tres movimientos. Toda la quincena.
              </h2>
            </Reveal>

            <ol className="mt-14 divide-y divide-[#0b1220]/10 border-y border-[#0b1220]/10">
              {STEPS.map((step, index) => (
                <motion.li
                  key={step.n}
                  className="grid gap-4 py-8 sm:grid-cols-[5rem_1fr] sm:gap-10 md:py-10"
                  initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-8% 0px' }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.06,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <span className="font-[family-name:var(--font-landing-display)] text-sm font-semibold tracking-[0.18em] text-[#2E8DF5]">
                    {step.n}
                  </span>
                  <div>
                    <h3 className="font-[family-name:var(--font-landing-display)] text-xl font-semibold tracking-tight text-[#0b1220] sm:text-2xl">
                      {step.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#0b1220]/55 sm:text-base">
                      {step.body}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        <section className="relative z-10 border-t border-[#0b1220]/8">
          <Reveal>
            <div className="relative overflow-hidden bg-[#0b1220] px-5 py-20 text-white sm:px-8 md:px-12 md:py-28">
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-[#2E8DF5]/28 blur-3xl"
                animate={
                  reduceMotion
                    ? undefined
                    : { x: [0, 36, 0], y: [0, 20, 0], opacity: [0.35, 0.65, 0.35] }
                }
                transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                aria-hidden
                className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-cyan-400/18 blur-3xl"
                animate={
                  reduceMotion
                    ? undefined
                    : { x: [0, -28, 0], y: [0, -16, 0], opacity: [0.25, 0.5, 0.25] }
                }
                transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
              />
              <div className="relative mx-auto max-w-6xl">
                <p className="font-[family-name:var(--font-landing-display)] text-[clamp(2.5rem,8vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.04em]">
                  MiCasa
                </p>
                <h2 className="mt-5 max-w-xl font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-[-0.03em] sm:text-3xl md:text-4xl">
                  Empieza tu próxima quincena con claridad
                </h2>
                <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
                  Sin tarjeta. Empiezas en minutos.
                </p>
                <div className="mt-9">
                  <Link
                    href="/register"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-white px-7 text-base font-medium text-[#0b1220] transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    Crear cuenta
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#0b1220]/8 bg-[#eef3f8]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-[#0b1220]/45 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {new Date().getFullYear()} MiCasa. Hecho para quincenas en México.</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
            <Link className="transition-colors hover:text-[#0b1220]/80" href="/privacy">
              Aviso de privacidad
            </Link>
            <Link className="transition-colors hover:text-[#0b1220]/80" href="/terms">
              Términos de uso
            </Link>
            <Link className="transition-colors hover:text-[#0b1220]/80" href="/login">
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
