'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarRange, House, WalletCards } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ProductMock } from '@/components/landing/product-mocks';

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

export const LandingPage = () => {
  const reduceMotion = useReducedMotion();
  const fadeUp = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 18 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="relative min-h-svh overflow-x-hidden bg-[#0a0b10] text-white">
      {/* Atmosphere — brand blue→violet plane, not a flat fill */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(46,141,245,0.35),transparent_55%),radial-gradient(ellipse_50%_40%_at_90%_20%,rgba(172,61,243,0.22),transparent_50%),radial-gradient(ellipse_40%_30%_at_10%_40%,rgba(46,141,245,0.12),transparent_45%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 md:px-8">
        <Link href="/" className="inline-flex items-center" aria-label="MiCasa inicio">
          <Image
            src="/logo-white.svg"
            alt="MiCasa"
            width={160}
            height={51}
            className="h-10 w-auto"
            priority
            unoptimized
          />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Acceso">
          <Button variant="ghost" className="h-9 text-white/80 hover:bg-white/10 hover:text-white" asChild>
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button className="h-9 shadow-lg shadow-violet-600/20" asChild>
            <Link href="/register">Crear cuenta</Link>
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero — one composition: brand, headline, sentence, CTAs, dominant product visual */}
        <section className="relative z-10 mx-auto grid min-h-[calc(100svh-5.5rem)] w-full max-w-6xl items-center gap-10 px-6 pb-16 pt-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-12 md:px-8 md:pb-20 md:pt-4">
          <motion.div
            className="max-w-xl"
            initial="hidden"
            animate="show"
            variants={{
              show: {
                transition: { staggerChildren: reduceMotion ? 0 : 0.1 },
              },
            }}
          >
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.45 }}
              className="mb-4 font-[family-name:var(--font-geist-sans)] text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl"
            >
              <span className="bg-linear-to-r from-[#2E8DF5] to-[#AC3DF3] bg-clip-text text-transparent">
                MiCasa
              </span>
            </motion.p>
            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.45 }}
              className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-[2.75rem] md:leading-[1.15]"
            >
              Tu quincena, clara de punta a punta.
            </motion.h1>
            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.45 }}
              className="mt-4 max-w-md text-pretty text-base leading-relaxed text-white/65 sm:text-lg"
            >
              Planifica ingresos, gastos y obligaciones por quincenas — el ritmo
              real de cobrar y pagar en México.
            </motion.p>
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.45 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <Button size="lg" className="h-11 px-6 text-base shadow-lg shadow-violet-600/25" asChild>
                <Link href="/register">
                  Empezar gratis
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 border-white/20 bg-white/5 px-6 text-base text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href="/login">Ya tengo cuenta</Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            className="relative"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: reduceMotion ? 0 : 0.15 }}
          >
            <motion.div
              aria-hidden
              className="absolute -inset-6 rounded-[2rem] bg-linear-to-br from-[#2E8DF5]/25 via-transparent to-[#AC3DF3]/30 blur-2xl"
              animate={
                reduceMotion
                  ? undefined
                  : { opacity: [0.45, 0.75, 0.45], scale: [1, 1.03, 1] }
              }
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <ProductMock className="relative" variant="fortnight" />
          </motion.div>
        </section>

        {/* Screenshots / product proof */}
        <section
          id="producto"
          className="relative z-10 border-t border-white/10 bg-black/25 py-20 md:py-28"
          aria-labelledby="producto-heading"
        >
          <div className="mx-auto max-w-6xl px-6 md:px-8">
            <div className="max-w-2xl">
              <h2
                id="producto-heading"
                className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
              >
                Del plan quincenal al saldo real
              </h2>
              <p className="mt-3 text-base leading-relaxed text-white/60">
                Un vistazo a cómo MiCasa organiza tu flujo de efectivo, billeteras
                y el panel del día a día.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <ProductMock variant="dashboard" />
              <ProductMock variant="wallets" />
            </div>

            <ul className="mt-16 grid gap-10 sm:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature.title}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-[#2E8DF5]/20 to-[#AC3DF3]/20 ring-1 ring-white/10">
                    <feature.icon
                      className="size-5 text-[#8eb8ff]"
                      aria-hidden
                    />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/55">
                    {feature.body}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-14 flex flex-wrap items-center gap-3">
              <Button size="lg" className="h-11 px-6" asChild>
                <Link href="/register">
                  Crear cuenta
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <p className="text-sm text-white/45">
                Sin tarjeta. Empiezas en minutos.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-white/45 md:flex-row md:items-center md:justify-between md:px-8">
          <p>© {new Date().getFullYear()} MiCasa. Hecho para quincenas en México.</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
            <Link className="hover:text-white/80" href="/privacy">
              Aviso de privacidad
            </Link>
            <Link className="hover:text-white/80" href="/terms">
              Términos de uso
            </Link>
            <Link className="hover:text-white/80" href="/login">
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
