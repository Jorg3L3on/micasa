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
import { ArrowRight, CalendarRange, House, WalletCards } from 'lucide-react';

import { MicasaMark } from '@/components/brand/micasa-mark';
import { LandingAtmosphere } from '@/components/landing/landing-atmosphere';
import { ProductMock } from '@/components/landing/product-mocks';
import { cn } from '@/lib/utils';

const FEATURES = [
  {
    icon: CalendarRange,
    title: 'Planificación por quincenas',
    body: 'Organiza ingresos y gastos en periodos 1–15 y 16–fin de mes, como cobras en México.',
  },
  {
    icon: WalletCards,
    title: 'Billeteras, tarjetas y préstamos',
    body: 'Sigue efectivo, débito, crédito, estados de cuenta y cuotas sin perder el hilo del flujo de caja.',
  },
  {
    icon: House,
    title: 'Personal o casa compartida',
    body: 'Lleva tus finanzas a solas o con el hogar: un solo lugar para la quincena de todos.',
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
    <motion.div style={{ x: springX, y: springY }} className="inline-flex">
      <Link
        href={href}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={cn(
          'inline-flex h-12 items-center justify-center gap-2 rounded-md px-7 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E8DF5]/50',
          variant === 'primary' &&
            'bg-[#0b1220] text-white hover:bg-[#152038]',
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
      initial={reduceMotion ? false : { opacity: 0, y: 32, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-12% 0px' }}
      transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

export const LandingPage = () => {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const spotlightX = useMotionValue(50);
  const spotlightY = useMotionValue(30);
  const smoothSpotX = useSpring(spotlightX, { stiffness: 60, damping: 20 });
  const smoothSpotY = useSpring(spotlightY, { stiffness: 60, damping: 20 });
  const spotlight = useMotionTemplate`radial-gradient(540px circle at ${smoothSpotX}% ${smoothSpotY}%, rgba(46,141,245,0.18), transparent 55%)`;
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
    reduceMotion ? [0, 0] : [0, 140]
  );
  const productScale = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [1, 1] : [1, 1.08]
  );
  const productOpacity = useTransform(
    scrollYProgress,
    [0, 0.9],
    reduceMotion ? [1, 1] : [1, 0.45]
  );
  const productRotate = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [1.4, -2]
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

      {/* Film grain — subtle texture without flat fill */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <header
        className={cn(
          'sticky top-0 z-30 transition-[background-color,border-color,backdrop-filter] duration-300',
          headerSolid
            ? 'border-b border-[#0b1220]/8 bg-[#eef3f8]/75 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 md:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-[#0b1220] transition-opacity hover:opacity-80"
            aria-label="MiCasa inicio"
          >
            <MicasaMark className="h-8 w-auto" />
            <span className="font-[family-name:var(--font-landing-display)] text-lg font-semibold tracking-tight">
              MiCasa
            </span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Acceso">
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-[#0b1220]/70 transition-colors hover:bg-[#0b1220]/5 hover:text-[#0b1220]"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center rounded-md bg-[#0b1220] px-4 text-sm font-medium text-white transition-colors hover:bg-[#152038]"
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
          className="relative z-10 flex min-h-[calc(100svh-4.25rem)] flex-col"
        >
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0"
            style={{ background: spotlight }}
          />

          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-8 pt-6 md:px-8 md:pb-12 md:pt-4">
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
                  hidden: { opacity: 0, y: reduceMotion ? 0 : 28 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                className="font-[family-name:var(--font-landing-display)] text-[clamp(4.25rem,15vw,8.25rem)] font-bold leading-[0.88] tracking-[-0.045em] text-[#0b1220]"
              >
                <motion.span
                  className="inline-block bg-[linear-gradient(115deg,#0b1220_8%,#2E8DF5_48%,#0891b2_88%)] bg-[length:220%_100%] bg-clip-text text-transparent"
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

              <h1 className="mt-7 max-w-2xl text-balance font-[family-name:var(--font-landing-display)] text-[clamp(1.85rem,4.8vw,3.4rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[#0b1220]">
                {HEADLINE_WORDS.map((word, index) => (
                  <motion.span
                    key={`${word}-${index}`}
                    className="mr-[0.28em] inline-block last:mr-0"
                    variants={{
                      hidden: {
                        opacity: 0,
                        y: reduceMotion ? 0 : 20,
                        filter: reduceMotion ? 'blur(0px)' : 'blur(8px)',
                      },
                      show: {
                        opacity: 1,
                        y: 0,
                        filter: 'blur(0px)',
                      },
                    }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {word}
                  </motion.span>
                ))}
              </h1>

              <motion.p
                variants={{
                  hidden: { opacity: 0, y: reduceMotion ? 0 : 16 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="mt-5 max-w-md text-pretty text-base leading-relaxed text-[#0b1220]/58 sm:text-lg"
              >
                Planifica ingresos, gastos y obligaciones por quincenas — el ritmo
                real de cobrar y pagar en México.
              </motion.p>

              <motion.div
                variants={{
                  hidden: { opacity: 0, y: reduceMotion ? 0 : 16 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="mt-9 flex flex-wrap items-center gap-3"
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

          <div className="relative z-0 mt-auto w-full [perspective:1600px]">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 64 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.05, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="origin-bottom will-change-transform"
                style={{
                  transform: productTransform,
                  opacity: productOpacity,
                  transformStyle: 'preserve-3d',
                }}
              >
                <div className="relative left-1/2 w-[min(152vw,96rem)] -translate-x-1/2">
                  <ProductMock variant="hero" />
                </div>
              </motion.div>
            </motion.div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -bottom-px h-32 bg-linear-to-t from-[#eef3f8] via-[#eef3f8]/70 to-transparent"
            />
          </div>
        </section>

        <section
          id="producto"
          className="relative z-10 border-t border-[#0b1220]/8 py-20 md:py-28"
          aria-labelledby="producto-heading"
        >
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <Reveal>
              <h2
                id="producto-heading"
                className="max-w-2xl font-[family-name:var(--font-landing-display)] text-3xl font-semibold tracking-[-0.03em] text-[#0b1220] sm:text-4xl md:text-[2.75rem]"
              >
                Del plan quincenal al saldo real
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[#0b1220]/55">
                Un vistazo a cómo MiCasa organiza tu flujo de efectivo, billeteras
                y el panel del día a día.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-5 lg:grid-cols-2">
              <Reveal delay={0.05}>
                <motion.div
                  whileHover={reduceMotion ? undefined : { y: -4 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                >
                  <ProductMock variant="dashboard" />
                </motion.div>
              </Reveal>
              <Reveal delay={0.12}>
                <motion.div
                  whileHover={reduceMotion ? undefined : { y: -4 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                >
                  <ProductMock variant="wallets" />
                </motion.div>
              </Reveal>
            </div>
          </div>
        </section>

        <section
          className="relative z-10 border-t border-[#0b1220]/8 py-20 md:py-28"
          aria-labelledby="capacidades-heading"
        >
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <Reveal>
              <h2
                id="capacidades-heading"
                className="font-[family-name:var(--font-landing-display)] text-3xl font-semibold tracking-[-0.03em] text-[#0b1220] sm:text-4xl md:text-[2.75rem]"
              >
                Hecho para cómo se vive el dinero aquí
              </h2>
            </Reveal>

            <ul className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10">
              {FEATURES.map((feature, index) => (
                <motion.li
                  key={feature.title}
                  className="group"
                  initial={
                    reduceMotion
                      ? false
                      : { opacity: 0, y: 32, filter: 'blur(10px)' }
                  }
                  whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  viewport={{ once: true, margin: '-12% 0px' }}
                  transition={{
                    duration: 0.75,
                    delay: index * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2E8DF5]/12 ring-1 ring-[#2E8DF5]/15 transition-transform duration-300 group-hover:-translate-y-0.5">
                    <feature.icon
                      className="size-5 text-[#1d6fd1]"
                      aria-hidden
                    />
                  </span>
                  <h3 className="mt-5 font-[family-name:var(--font-landing-display)] text-lg font-semibold tracking-tight text-[#0b1220]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#0b1220]/55">
                    {feature.body}
                  </p>
                </motion.li>
              ))}
            </ul>
          </div>
        </section>

        <section className="relative z-10 border-t border-[#0b1220]/8 py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <Reveal>
              <div className="relative overflow-hidden bg-[#0b1220] px-8 py-16 text-white sm:px-12 md:py-20">
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-[#2E8DF5]/30 blur-3xl"
                  animate={
                    reduceMotion
                      ? undefined
                      : { x: [0, 40, 0], y: [0, 24, 0], opacity: [0.4, 0.7, 0.4] }
                  }
                  transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl"
                  animate={
                    reduceMotion
                      ? undefined
                      : { x: [0, -30, 0], y: [0, -20, 0], opacity: [0.3, 0.55, 0.3] }
                  }
                  transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="relative max-w-xl">
                  <h2 className="font-[family-name:var(--font-landing-display)] text-3xl font-semibold tracking-[-0.03em] sm:text-4xl md:text-[2.75rem]">
                    Empieza tu próxima quincena con claridad
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-white/60">
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
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-[#0b1220]/8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-[#0b1220]/45 md:flex-row md:items-center md:justify-between md:px-8">
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
