'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
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
import { ArrowRight, Menu, Play, Star, X } from 'lucide-react';

import { MicasaMark } from '@/components/brand/micasa-mark';
import { FortnightScrub } from '@/components/landing/fortnight-scrub';
import { HeroDashboardMock } from '@/components/landing/hero-dashboard-mock';
import { LandingAtmosphere } from '@/components/landing/landing-atmosphere';
import { LandingPricing } from '@/components/landing/landing-pricing';
import { LandingLink, Reveal } from '@/components/landing/landing-ui';
import { ProductMock } from '@/components/landing/product-mocks';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { getWalletProviderOption } from '@/lib/wallet-provider-icons';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#producto', label: 'Producto' },
  { href: '#quincena', label: 'Cómo funciona' },
  { href: '#precios', label: 'Precios' },
] as const;

const HEADLINE_WORDS = ['Controla', 'tu', 'quincena', 'en', 'tiempo', 'real'];

const PROOF = [
  'Hecho para quincenas mexicanas',
  'Personal o casa compartida',
  'Tarjetas, préstamos y proyección',
] as const;

const STEPS = [
  {
    n: '01',
    title: 'Arma la quincena',
    body: 'Ingresos y gastos de un payday al siguiente: último día del mes al 14, y del 15 al penúltimo — el ritmo real de cobrar en México.',
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

const INTEGRATIONS = [
  'BBVA',
  'BANAMEX',
  'SANTANDER',
  'MERCADO_PAGO',
  'DIDI',
  'NU_BANK',
  'LIVERPOOL',
  'PAYPAL',
  'AMEX',
  'CA',
] as const;

const BOTTOM_FEATURES = [
  {
    title: 'Flujo inteligente',
    body: 'El radar de la quincena: ingresos, cortes y préstamos en un solo mapa.',
  },
  {
    title: 'Insights automáticos',
    body: 'Valle de liquidez, mínimo de tarjeta y metas sin armar hojas a mano.',
  },
  {
    title: 'Visibilidad total',
    body: 'Personal o casa: el mismo panel, el mismo ritmo, sin sorpresas de corte.',
  },
] as const;

export const LandingPage = () => {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const spotlightX = useMotionValue(72);
  const spotlightY = useMotionValue(28);
  const smoothSpotX = useSpring(spotlightX, { stiffness: 60, damping: 20 });
  const smoothSpotY = useSpring(spotlightY, { stiffness: 60, damping: 20 });
  const spotlight = useMotionTemplate`radial-gradient(520px circle at ${smoothSpotX}% ${smoothSpotY}%, rgba(145,30,254,0.18), transparent 58%)`;
  const [headerSolid, setHeaderSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const productY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 48]);
  const productRotate = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [1.4, -0.4]);
  const productTransform = useMotionTemplate`translate3d(0, ${productY}px, 0) rotateX(${productRotate}deg)`;

  const handleHeroPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    spotlightX.set(((event.clientX - rect.left) / rect.width) * 100);
    spotlightY.set(((event.clientY - rect.top) / rect.height) * 100);
  };

  const handleToggleMenu = () => {
    setMenuOpen((open) => !open);
  };

  return (
    <div
      className={cn(
        'landing-root relative min-h-svh overflow-x-clip scroll-smooth bg-[#060914] text-white',
        'font-[family-name:var(--font-landing-sans)]'
      )}
    >
      <LandingAtmosphere />

      <header
        className={cn(
          'sticky top-0 z-30 transition-[background-color,border-color,backdrop-filter] duration-300',
          headerSolid
            ? 'border-b border-white/8 bg-[#060914]/80 backdrop-blur-xl'
            : 'border-b border-transparent bg-transparent'
        )}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6 md:px-8">
          <Link
            href="#inicio"
            className="inline-flex items-center gap-2.5 text-white transition-opacity hover:opacity-80"
            aria-label="MiCasa inicio"
          >
            <MicasaMark className="h-7 w-auto sm:h-8" />
            <span className="font-[family-name:var(--font-landing-display)] text-base font-semibold tracking-tight sm:text-lg">
              MiCasa
            </span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Secciones">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden h-10 items-center rounded-full px-3 text-sm font-medium text-white/70 transition-colors hover:text-white sm:inline-flex"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="landing-cta inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(255,87,51,0.8)] hover:brightness-110"
            >
              Empezar
            </Link>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 text-white lg:hidden"
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
              onClick={handleToggleMenu}
            >
              {menuOpen ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
            </button>
          </div>
        </div>

        {menuOpen ? (
          <nav
            className="border-t border-white/8 bg-[#060914]/95 px-5 py-4 backdrop-blur-xl lg:hidden"
            aria-label="Secciones móviles"
          >
            <ul className="flex flex-col gap-3">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block py-1 text-sm text-white/75"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/login" className="block py-1 text-sm text-white/75">
                  Iniciar sesión
                </Link>
              </li>
            </ul>
          </nav>
        ) : null}
      </header>

      <main>
        <section
          id="inicio"
          ref={heroRef}
          onPointerMove={handleHeroPointerMove}
          className="relative z-10 scroll-mt-20 overflow-hidden pb-16 pt-10 sm:pb-20 sm:pt-14 lg:pb-24 lg:pt-16"
        >
          <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-6 md:px-8">
            <div className="landing-hero-wash relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-12 lg:rounded-[2.5rem] lg:px-12 lg:py-14">
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-[1]"
                style={{ background: spotlight }}
              />

              <div className="relative z-10 grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10">
                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={{
                    show: {
                      transition: { staggerChildren: reduceMotion ? 0 : 0.07 },
                    },
                  }}
                  className="relative max-w-xl"
                >
                  <h1 className="text-balance font-[family-name:var(--font-landing-display)] text-[clamp(2.4rem,6vw,4.35rem)] font-bold leading-[1.05] tracking-[-0.04em] text-white">
                    {HEADLINE_WORDS.map((word, index) => (
                      <motion.span
                        key={`${word}-${index}`}
                        className={cn(
                          'mr-[0.28em] inline-block last:mr-0',
                          index >= 4 && 'landing-accent-text',
                        )}
                        variants={{
                          hidden: { opacity: 0, y: reduceMotion ? 0 : 18 },
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
                    className="mt-5 max-w-md text-pretty text-base leading-relaxed text-white/70 sm:text-lg"
                  >
                    Plataforma unificada para ingresos, gastos, tarjetas y liquidez —
                    al ritmo real de cobrar y pagar en México.
                  </motion.p>

                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: reduceMotion ? 0 : 14 },
                      show: { opacity: 1, y: 0 },
                    }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center"
                  >
                    <LandingLink href="/register" variant="primary">
                      Empezar ahora
                      <ArrowRight className="size-4" aria-hidden />
                    </LandingLink>
                    <LandingLink href="#producto" variant="ghost">
                      <Play className="size-4" aria-hidden />
                      Ver producto
                    </LandingLink>
                  </motion.div>

                  <motion.p
                    variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                    className="mt-6 inline-flex items-center gap-2 text-sm text-white/55"
                  >
                    <Star className="size-3.5 fill-amber-300 text-amber-300" aria-hidden />
                    Hecho para quincenas mexicanas · Gratis, sin tarjeta
                  </motion.p>
                </motion.div>

                <div className="relative [perspective:1600px]">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-[radial-gradient(circle_at_center,rgba(145,30,254,0.28),transparent_68%)] blur-2xl"
                  />
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.95, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                    className="origin-bottom will-change-transform"
                    style={{ transform: productTransform, transformStyle: 'preserve-3d' }}
                  >
                    <HeroDashboardMock />
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-10 border-y border-white/[0.06]" aria-label="Por qué MiCasa">
          <Reveal>
            <ul className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 md:px-8 md:py-8">
              {PROOF.map((item) => (
                <li
                  key={item}
                  className="font-[family-name:var(--font-landing-display)] text-[0.95rem] font-medium tracking-tight text-white/70 sm:text-base"
                >
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </section>

        <section
          id="producto"
          className="relative z-10 scroll-mt-20 py-24 md:py-32"
          aria-labelledby="producto-heading"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#911efe]">
                Control
              </p>
              <h2
                id="producto-heading"
                className="mt-3 max-w-2xl font-[family-name:var(--font-landing-display)] text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl md:text-[2.75rem]"
              >
                Una plataforma construida para control absoluto
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/50">
                Las mismas superficies de la app: liquidez hacia adelante y crédito
                sin sorpresas de corte.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-5 lg:grid-cols-2">
              <Reveal>
                <div className="landing-glass-card overflow-hidden rounded-2xl p-5 sm:p-6">
                  <p className="text-sm font-medium text-white/80">
                    Analítica predictiva que revela el valle antes de llegar a él.
                  </p>
                  <div className="mt-5">
                    <ProductMock variant="liquidity" />
                  </div>
                </div>
              </Reveal>
              <Reveal delay={0.06}>
                <div className="landing-glass-card overflow-hidden rounded-2xl p-5 sm:p-6">
                  <p className="text-sm font-medium text-white/80">
                    Inteligencia en tiempo real: pagado, pendiente y crédito en el mismo ritmo.
                  </p>
                  <div className="mt-5">
                    <ProductMock variant="cards" />
                  </div>
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.08}>
              <div className="landing-glass-card mt-5 overflow-hidden rounded-2xl p-5 sm:p-8">
                <div className="mx-auto max-w-2xl text-center">
                  <h3 className="font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                    Ve tu casa desde otra perspectiva
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/50 sm:text-base">
                    Panel, quincena y billeteras en un mismo lienzo — con el detalle
                    que usas al planear del último día al 14 y del 15 al penúltimo.
                  </p>
                </div>
                <div className="mt-8">
                  <HeroDashboardMock />
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section
          className="relative z-10 border-y border-white/[0.06] py-16 md:py-20"
          aria-labelledby="integraciones-heading"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
            <Reveal>
              <h2
                id="integraciones-heading"
                className="text-center font-[family-name:var(--font-landing-display)] text-2xl font-semibold tracking-tight text-white sm:text-3xl"
              >
                Conectado a las cuentas que ya usas
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-center text-sm text-white/45">
                Bancos, tarjetas de tienda y wallets de México, listos para armar la quincena.
              </p>
            </Reveal>
            <ul className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {INTEGRATIONS.map((key) => (
                <li
                  key={key}
                  className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 grayscale transition hover:grayscale-0"
                >
                  <WalletProviderIcon
                    providerIconKey={key}
                    className="h-7 w-7 border-white/10 bg-white/5"
                    showTooltipLabel={false}
                  />
                  <span className="text-sm text-white/70">
                    {getWalletProviderOption(key)?.label ?? key}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div id="quincena" className="scroll-mt-20">
          <FortnightScrub />
        </div>

        <section
          className="relative z-10 py-20 md:py-28"
          aria-labelledby="pasos-heading"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
            <Reveal>
              <h2
                id="pasos-heading"
                className="font-[family-name:var(--font-landing-display)] text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl"
              >
                Tres movimientos. Toda la quincena.
              </h2>
            </Reveal>

            <ol className="mt-14 divide-y divide-white/10 border-y border-white/10">
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
                  <span className="font-[family-name:var(--font-landing-display)] text-sm font-semibold tracking-[0.18em] text-[#ff5733]">
                    {step.n}
                  </span>
                  <div>
                    <h3 className="font-[family-name:var(--font-landing-display)] text-xl font-semibold tracking-tight text-white sm:text-2xl">
                      {step.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/50 sm:text-base">
                      {step.body}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        <LandingPricing />

        <section className="relative z-10 pb-8" aria-labelledby="cta-heading">
          <Reveal>
            <div className="relative overflow-hidden border-y border-white/[0.06] px-5 py-20 sm:px-8 md:px-12 md:py-28">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,87,51,0.14),transparent_60%)]"
              />
              <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="max-w-xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ff5733]">
                    Camino a la claridad
                  </p>
                  <h2
                    id="cta-heading"
                    className="mt-3 font-[family-name:var(--font-landing-display)] text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl md:text-5xl"
                  >
                    ¿Listo para entrar? Empieza tu quincena hoy.
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-white/55">
                    Crea tu cuenta gratis. Sin tarjeta. En minutos estás en tu primera quincena.
                  </p>
                  <div className="mt-8">
                    <LandingLink href="/register" variant="primary">
                      Crear cuenta gratis
                      <ArrowRight className="size-4" aria-hidden />
                    </LandingLink>
                  </div>
                </div>

                <div className="relative mx-auto w-full max-w-xl">
                  <div className="rounded-[1.6rem] border border-white/12 bg-[#111319] p-2 shadow-[0_40px_100px_-40px_rgba(58,55,252,0.65)]">
                    <div className="overflow-hidden rounded-[1.15rem]">
                      <ProductMock variant="hero" />
                    </div>
                  </div>
                  <div className="mx-auto h-2 w-[72%] rounded-b-xl bg-white/10" aria-hidden />
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <section className="relative z-10 py-20 md:py-24" aria-label="Capacidades">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 sm:grid-cols-3 sm:px-6 md:px-8">
            {BOTTOM_FEATURES.map((feature, index) => (
              <Reveal key={feature.title} delay={index * 0.05}>
                <div className="landing-glass-card rounded-2xl p-6">
                  <h3 className="font-[family-name:var(--font-landing-display)] text-lg font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{feature.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-white/40 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {new Date().getFullYear()} MiCasa. Hecho para quincenas en México.</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
            <Link className="transition-colors hover:text-white/80" href="/privacy">
              Aviso de privacidad
            </Link>
            <Link className="transition-colors hover:text-white/80" href="/terms">
              Términos de uso
            </Link>
            <Link className="transition-colors hover:text-white/80" href="/login">
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
