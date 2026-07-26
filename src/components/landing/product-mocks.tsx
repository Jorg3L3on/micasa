'use client';

import { AnimatedAmount } from '@/components/landing/animated-amount';
import { cn } from '@/lib/utils';

type ProductMockProps = {
  className?: string;
  variant?: 'hero' | 'liquidity' | 'cards' | 'wallets' | 'dashboard' | 'fortnight';
};

/** Static UI frames used as landing “screenshots” (no live data). */
export const ProductMock = ({
  className,
  variant = 'fortnight',
}: ProductMockProps) => {
  if (variant === 'hero') {
    return (
      <div
        className={cn(
          'overflow-hidden border-y border-white/10 bg-[#0e1118] text-left shadow-[0_40px_120px_-48px_rgba(15,23,42,0.55)]',
          className
        )}
        role="img"
        aria-label="Vista previa del planificador por quincenas de MiCasa"
      >
        <div
          aria-hidden
          className="h-px w-full bg-linear-to-r from-transparent via-[#2E8DF5]/70 to-transparent"
        />
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium tracking-wide text-white/50">
              Quincena · 1–15 jul
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" />
            <span className="hidden text-xs text-white/35 sm:inline">Casa León</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-white/40">
            <span>Ingresos</span>
            <span className="text-white/70">Gastos</span>
            <span>Balance</span>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3 border-b border-white/10 p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Balance quincena
                </p>
                <p className="mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight text-emerald-400 sm:text-4xl">
                  <AnimatedAmount value={3370} />
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-white/40">Pagado 58%</p>
                <div className="mt-2 flex h-1.5 w-28 overflow-hidden rounded-full bg-white/10 sm:w-36">
                  <div className="h-full w-[58%] bg-emerald-500" />
                  <div className="h-full w-[42%] bg-amber-400" />
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {[
                { name: 'Nómina', amount: '+$12,000', tone: 'text-emerald-400' },
                { name: 'Freelance', amount: '+$3,500', tone: 'text-emerald-400' },
                { name: 'Renta', amount: '-$8,500', tone: 'text-white/80' },
                { name: 'Despensa', amount: '-$2,180', tone: 'text-white/80' },
                { name: 'Tarjeta', amount: '-$1,450', tone: 'text-white/80' },
                { name: 'Luz', amount: '-$1,000', tone: 'text-white/80' },
              ].map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
                >
                  <span className="text-xs text-white/75">{row.name}</span>
                  <span
                    className={cn(
                      'font-mono text-xs font-semibold tabular-nums',
                      row.tone
                    )}
                  >
                    {row.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-4 p-5 sm:p-8">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Hoy en la quincena
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/55">
                Renta pagada. Quedan despensa y tarjeta antes del día 15.
              </p>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Listo', value: '$8,500', border: 'border-l-emerald-500/60' },
                { label: 'Por pagar', value: '$3,630', border: 'border-l-amber-500/60' },
                { label: 'Sobra', value: '$3,370', border: 'border-l-[#2E8DF5]/60' },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className={cn(
                    'border border-white/10 border-l-[3px] bg-white/[0.03] px-3 py-2.5',
                    metric.border
                  )}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
                    {metric.label}
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold tabular-nums text-white">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'liquidity') {
    return (
      <div
        className={cn('overflow-hidden border border-[#0b1220]/10 bg-[#0e1118] text-left', className)}
        role="img"
        aria-label="Vista previa de proyección de liquidez a 180 días"
      >
        <div className="border-b border-white/10 px-5 py-3">
          <p className="text-xs font-medium text-white/50">Liquidez · 180 días</p>
        </div>
        <div className="space-y-5 p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              Punto más bajo
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-amber-300">
              <AnimatedAmount value={4820} decimals={0} />
            </p>
            <p className="mt-1 text-xs text-white/45">12 sep · después de colegiatura</p>
          </div>

          <div className="relative h-28 overflow-hidden border border-white/10 bg-black/20">
            <svg
              viewBox="0 0 320 112"
              className="absolute inset-0 h-full w-full"
              aria-hidden
            >
              <defs>
                <linearGradient id="liqFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2E8DF5" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#2E8DF5" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 40 C40 28, 70 52, 110 46 C150 40, 180 70, 220 58 C260 46, 290 62, 320 34 L320 112 L0 112 Z"
                fill="url(#liqFill)"
              />
              <path
                d="M0 40 C40 28, 70 52, 110 46 C150 40, 180 70, 220 58 C260 46, 290 62, 320 34"
                fill="none"
                stroke="#2E8DF5"
                strokeWidth="2.5"
              />
              <circle cx="180" cy="70" r="4" fill="#fbbf24" />
            </svg>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Hoy', value: '$18.4k' },
              { label: '30 días', value: '$11.2k' },
              { label: '180 días', value: '$9.6k' },
            ].map((item) => (
              <div key={item.label} className="border border-white/10 bg-white/[0.03] px-2.5 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
                  {item.label}
                </p>
                <p className="mt-1 font-mono text-xs font-bold tabular-nums text-white">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div
        className={cn('overflow-hidden border border-[#0b1220]/10 bg-[#0e1118] text-left', className)}
        role="img"
        aria-label="Vista previa de tarjetas y cuotas pendientes"
      >
        <div className="border-b border-white/10 px-5 py-3">
          <p className="text-xs font-medium text-white/50">Tarjetas · ciclo actual</p>
        </div>
        <div className="space-y-3 p-5 sm:p-6">
          {[
            {
              name: 'Mercado Pago',
              due: 'Corte 28 jul',
              used: '$6,840',
              min: 'Mín. $820',
              accent: 'border-l-[#2E8DF5]/60',
            },
            {
              name: 'DiDi Card',
              due: 'Corte 5 ago',
              used: '$2,150',
              min: 'Mín. $340',
              accent: 'border-l-violet-400/60',
            },
          ].map((card) => (
            <div
              key={card.name}
              className={cn(
                'border border-white/10 border-l-[3px] bg-white/[0.03] px-3 py-3',
                card.accent
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white/90">{card.name}</p>
                  <p className="mt-0.5 text-[11px] text-white/40">{card.due}</p>
                </div>
                <p className="font-mono text-sm font-bold tabular-nums text-white">
                  {card.used}
                </p>
              </div>
              <p className="mt-2 text-[11px] text-white/45">{card.min}</p>
            </div>
          ))}
          <div className="border border-white/10 bg-black/20 px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Cuotas activas
            </p>
            <p className="mt-1 text-sm text-white/75">
              Laptop · 4/12 · <span className="font-mono tabular-nums">$1,190</span>/mes
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'wallets') {
    return (
      <div
        className={cn('overflow-hidden border border-[#0b1220]/10 bg-[#0e1118] text-left', className)}
        role="img"
        aria-label="Vista previa de billeteras y saldo disponible"
      >
        <div className="border-b border-white/10 px-5 py-3">
          <p className="text-xs font-medium text-white/50">Billeteras</p>
        </div>
        <div className="space-y-3 p-5">
          <div className="border border-white/10 border-l-[3px] border-l-emerald-500/60 bg-white/[0.03] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Disponible
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
              <AnimatedAmount value={18450} />
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { name: 'BBVA Débito', amount: '$12,200.00' },
              { name: 'Efectivo', amount: '$6,250.00' },
            ].map((wallet) => (
              <div
                key={wallet.name}
                className="border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <p className="truncate text-xs font-medium text-white/80">{wallet.name}</p>
                <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-white">
                  {wallet.amount}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // legacy fortnight / dashboard kept for compatibility
  return (
    <div
      className={cn('overflow-hidden border border-[#0b1220]/10 bg-[#0e1118] text-left', className)}
      role="img"
      aria-label="Vista previa del planificador por quincenas"
    >
      <div className="border-b border-white/10 px-5 py-3">
        <p className="text-xs font-medium text-white/50">Quincena · 1–15 jul</p>
      </div>
      <div className="p-5">
        <p className="font-mono text-xl font-bold tabular-nums text-emerald-400">$3,370.00</p>
      </div>
    </div>
  );
};
