'use client';

import { useRef, type PointerEvent, type ReactNode } from 'react';
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
import { Button } from '@/components/ui/button';
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

const MagneticButton = ({
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
  const springX = useSpring(x, { stiffness: 260, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 260, damping: 18, mass: 0.4 });

  const handlePointerMove = (event: PointerEvent<HTMLAnchorElement>) => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left - rect.width / 2;
    const offsetY = event.clientY - rect.top - rect.height / 2;
    x.set(offsetX * 0.22);
    y.set(offsetY * 0.22);
  };

  const handlePointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div style={{ x: springX, y: springY }} className="inline-flex">
      <Button
        size="lg"
        variant={variant === 'primary' ? 'default' : 'outline'}
        className={cn(
          'h-12 px-7 text-base transition-[box-shadow,transform] duration-300',
          variant === 'primary' &&
            'bg-[#0b1220] text-white hover:bg-[#152038] shadow-none',
          variant === 'secondary' &&
            'border-[#0b1220]/15 bg-white/50 text-[#0b1220] backdrop-blur-sm hover:bg-white/80 hover:text-[#0b1220]',
          className
        )}
        asChild
      >
        <Link
          href={href}
          onPointerMove={handlePointerMove}
          onPointerLeave={handlePointerLeave}
        >
          {children}
        </Link>
      </Button>
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
      initial={reduceMotion ? false : { opacity: 0, y: 28, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
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
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const productY = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [0, 120]
  );
  const productScale = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [1, 1] : [1, 1.06]
  );
  const productOpacity = useTransform(
    scrollYProgress,
    [0, 0.85],
    reduceMotion ? [1, 1] : [1, 0.55]
  );
  const productRotate = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [0.8, -1.2]
  );
  const productTransform = useMotionTemplate`translate3d(0, ${productY}px, 0) scale(${productScale}) rotateX(${productRotate}deg)`;

  return (
    <div
      className={cn(
        'relative min-h-svh overflow-x-hidden bg-[#f3f6fa] text-[#0b1220]',
        'font-[family-name:var(--font-landing-sans)]'
      )}
    >
      <LandingAtmosphere />

      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 md:px-8">
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
          <Button
            variant="ghost"
            className="h-9 text-[#0b1220]/70 hover:bg-[#0b1220]/5 hover:text-[#0b1220]"
            asChild
          >
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button
            className="h-9 bg-[#0b1220] text-white hover:bg-[#152038]"
            asChild
          >
            <Link href="/register">Crear cuenta</Link>
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero — one composition: brand, headline, sentence, CTAs, full-bleed product plane */}
        <section
          ref={heroRef}
          className="relative z-10 flex min-h-[calc(100svh-4.5rem)] flex-col"
        >
          <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-10 pt-4 md:px-8 md:pb-14 md:pt-2">
            <motion.div
              initial="hidden"
              animate="show"
              variants={{
                show: {
                  transition: { staggerChildren: reduceMotion ? 0 : 0.08 },
                },
              }}
              className="relative z-10 max-w-3xl"
            >
              <motion.p
                variants={{
                  hidden: { opacity: 0, y: reduceMotion ? 0 : 24 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="font-[family-name:var(--font-landing-display)] text-[clamp(3.5rem,12vw,7.5rem)] font-bold leading-[0.9] tracking-[-0.04em]"
              >
                <span className="bg-[linear-gradient(115deg,#0b1220_10%,#2E8DF5_55%,#0ea5e9_90%)] bg-clip-text text-transparent">
                  MiCasa
                </span>
              </motion.p>

              <h1 className="mt-6 max-w-2xl text-balance font-[family-name:var(--font-landing-display)] text-[clamp(1.75rem,4.5vw,3.25rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-[#0b1220]">
                {HEADLINE_WORDS.map((word, index) => (
                  <motion.span
                    key={`${word}-${index}`}
                    className="mr-[0.28em] inline-block last:mr-0"
                    variants={{
                      hidden: {
                        opacity: 0,
                        y: reduceMotion ? 0 : 18,
                        filter: reduceMotion ? 'blur(0px)' : 'blur(6px)',
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
                className="mt-5 max-w-md text-pretty text-base leading-relaxed text-[#0b1220]/60 sm:text-lg"
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
                <MagneticButton href="/register" variant="primary">
                  Empezar gratis
                  <ArrowRight className="size-4" aria-hidden />
                </MagneticButton>
                <MagneticButton href="/login" variant="secondary">
                  Ya tengo cuenta
                </MagneticButton>
              </motion.div>
            </motion.div>
          </div>

          <div className="relative z-0 w-full [perspective:1400px]">
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 56 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.div
                className="origin-bottom will-change-transform"
                style={{
                  transform: productTransform,
                  opacity: productOpacity,
                  transformStyle: 'preserve-3d',
                }}
              >
                <div className="relative left-1/2 w-[min(140vw,92rem)] -translate-x-1/2">
                  <ProductMock variant="hero" />
                </div>
              </motion.div>
            </motion.div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-[#f3f6fa] to-transparent"
            />
          </div>
        </section>

        {/* Product proof — one job: see the product surfaces */}
        <section
          id="producto"
          className="relative z-10 border-t border-[#0b1220]/8 py-20 md:py-28"
          aria-labelledby="producto-heading"
        >
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <Reveal>
              <h2
                id="producto-heading"
                className="max-w-2xl font-[family-name:var(--font-landing-display)] text-3xl font-semibold tracking-[-0.03em] text-[#0b1220] sm:text-4xl"
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
                <ProductMock variant="dashboard" />
              </Reveal>
              <Reveal delay={0.12}>
                <ProductMock variant="wallets" />
              </Reveal>
            </div>
          </div>
        </section>

        {/* Capabilities — one job: three reasons, no card clutter */}
        <section
          className="relative z-10 border-t border-[#0b1220]/8 py-20 md:py-28"
          aria-labelledby="capacidades-heading"
        >
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <Reveal>
              <h2
                id="capacidades-heading"
                className="font-[family-name:var(--font-landing-display)] text-3xl font-semibold tracking-[-0.03em] text-[#0b1220] sm:text-4xl"
              >
                Hecho para cómo se vive el dinero aquí
              </h2>
            </Reveal>

            <ul className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-8">
              {FEATURES.map((feature, index) => (
                <Reveal key={feature.title} delay={index * 0.08}>
                  <li>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2E8DF5]/12 ring-1 ring-[#2E8DF5]/15">
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
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing CTA — one job */}
        <section className="relative z-10 border-t border-[#0b1220]/8 py-20 md:py-28">
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <Reveal>
              <div className="relative overflow-hidden border border-[#0b1220]/10 bg-[#0b1220] px-8 py-14 text-white sm:px-12 md:py-16">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_0%_0%,rgba(46,141,245,0.35),transparent_55%),radial-gradient(ellipse_50%_60%_at_100%_100%,rgba(14,165,233,0.2),transparent_50%)]"
                />
                <div className="relative max-w-xl">
                  <h2 className="font-[family-name:var(--font-landing-display)] text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                    Empieza tu próxima quincena con claridad
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-white/60">
                    Sin tarjeta. Empiezas en minutos.
                  </p>
                  <div className="mt-8">
                    <Button
                      size="lg"
                      className="h-12 bg-white px-7 text-base text-[#0b1220] hover:bg-white/90"
                      asChild
                    >
                      <Link href="/register">
                        Crear cuenta
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
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
            <Link className="hover:text-[#0b1220]/80" href="/privacy">
              Aviso de privacidad
            </Link>
            <Link className="hover:text-[#0b1220]/80" href="/terms">
              Términos de uso
            </Link>
            <Link className="hover:text-[#0b1220]/80" href="/login">
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
