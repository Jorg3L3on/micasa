'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';

import { Reveal } from '@/components/landing/landing-ui';
import { cn } from '@/lib/utils';

const PLANS = [
  {
    name: 'Personal',
    tagline: 'Para tu quincena, sin ruido',
    price: '$0',
    billed: 'Gratis para siempre',
    featured: false,
    features: [
      'Hasta dos quincenas por mes',
      'Billeteras de efectivo y débito',
      'Gastos e ingresos recurrentes',
      'Proyección de liquidez',
    ],
  },
  {
    name: 'Casa',
    tagline: 'Para el hogar que comparte el plan',
    price: '$0',
    billed: 'Gratis · sin tarjeta',
    featured: true,
    features: [
      'Todo lo de Personal',
      'Casa compartida con roles',
      'Tarjetas, cortes y cuotas',
      'Préstamos y calendario',
    ],
  },
  {
    name: 'Completo',
    tagline: 'El flujo entero, en un solo lugar',
    price: '$0',
    billed: 'Todas las superficies, sin límite',
    featured: false,
    features: [
      'Todo lo de Casa',
      'Importación de estados de cuenta',
      'Metas por billetera',
      'Alertas y panel financiero',
    ],
  },
] as const;

export const LandingPricing = () => {
  return (
    <section
      id="precios"
      className="relative z-10 scroll-mt-24 py-24 md:py-32"
      aria-labelledby="precios-heading"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-6 md:px-8">
        <Reveal>
          <div className="text-center">
            <h2
              id="precios-heading"
              className="font-[family-name:var(--font-landing-display)] text-3xl font-bold tracking-[-0.03em] text-white sm:text-4xl md:text-[2.75rem]"
            >
              Planes y precios
            </h2>
            <p className="mt-3 text-base text-white/50">
              Precios transparentes. Sin cargos ocultos.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-5 lg:grid-cols-3 lg:items-stretch">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 0.06}>
              <article
                className={cn(
                  'relative flex h-full flex-col rounded-2xl p-px',
                  plan.featured ? 'landing-pro-border shadow-[0_0_48px_-16px_rgba(255,77,0,0.55)]' : 'bg-white/[0.08]'
                )}
              >
                <div className="flex h-full flex-col rounded-2xl bg-[#0d1327] px-6 py-7">
                  {plan.featured ? (
                    <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-[#090e1d] px-3 py-1 text-[11px] font-medium text-white">
                      Más popular
                    </span>
                  ) : null}

                  <h3 className="font-[family-name:var(--font-landing-display)] text-xl font-semibold text-white">
                    {plan.name}
                  </h3>
                  <p className="mt-1 text-sm text-white/45">{plan.tagline}</p>
                  <p className="mt-6 font-[family-name:var(--font-landing-display)] text-5xl font-bold tracking-tight text-white">
                    {plan.price}
                  </p>
                  <p className="mt-1 text-xs text-white/40">{plan.billed}</p>

                  <ul className="mt-8 flex flex-1 flex-col gap-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-sm text-white/75">
                        <Check className="mt-0.5 size-4 shrink-0 text-white" aria-hidden />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/register"
                    className={cn(
                      'mt-8 inline-flex h-11 items-center justify-center rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5733]/60',
                      plan.featured
                        ? 'bg-white text-[#060914] hover:bg-white/90'
                        : 'border border-white/15 text-white hover:border-white/30 hover:bg-white/[0.05]'
                    )}
                  >
                    Empezar
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
};
