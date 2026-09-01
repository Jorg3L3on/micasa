'use client';

import { LineChart } from 'lucide-react';

import { AnimatedAmount } from '@/components/landing/animated-amount';
import { LiquidityChart } from '@/components/landing/liquidity-chart';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { cn } from '@/lib/utils';

type ProductMockProps = {
  className?: string;
  variant?: 'hero' | 'liquidity' | 'cards' | 'wallets' | 'dashboard' | 'fortnight';
};

const AppChrome = ({
  title,
  subtitle,
  tabs,
}: {
  title: string;
  subtitle?: string;
  tabs?: readonly string[];
}) => (
  <div className="border-b border-white/10 px-4 py-3 sm:px-5">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-white/70">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[11px] text-white/35">{subtitle}</p>
        ) : null}
      </div>
      {tabs?.length ? (
        <div className="hidden items-center gap-1 sm:flex">
          {tabs.map((tab, index) => (
            <span
              key={tab}
              className={cn(
                'rounded-md px-2 py-1 text-[11px]',
                index === 0
                  ? 'bg-white/10 text-white'
                  : 'text-white/40'
              )}
            >
              {tab}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  </div>
);

const MetricStrip = ({
  label,
  value,
  border,
  tone = 'text-white',
}: {
  label: string;
  value: string;
  border: string;
  tone?: string;
}) => (
  <div
    className={cn(
      'rounded-lg border border-white/10 border-l-[3px] bg-white/[0.03] px-2.5 py-2',
      border
    )}
  >
    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
      {label}
    </p>
    <p className={cn('mt-0.5 font-mono text-sm font-bold tabular-nums', tone)}>
      {value}
    </p>
  </div>
);

/** Static UI frames styled like the live MiCasa app chrome (no live data). */
export const ProductMock = ({
  className,
  variant = 'fortnight',
}: ProductMockProps) => {
  if (variant === 'hero') {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-[1.15rem] border border-white/10 bg-[#0d1327] text-left shadow-[0_40px_120px_-48px_rgba(58,55,252,0.45)]',
          className
        )}
        role="img"
        aria-label="Vista previa del planificador por quincenas de MiCasa"
      >
        <div
          aria-hidden
          className="h-px w-full bg-linear-to-r from-transparent via-[#911efe]/80 to-transparent"
        />
        <AppChrome
          title="Quincena · 30 jun–14 jul 2026"
          subtitle="Casa León · vista compartida"
          tabs={['Resumen', 'Ingresos', 'Gastos']}
        />

        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4 border-b border-white/10 p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                  Balance quincena
                </p>
                <p className="mt-1 font-mono text-3xl font-bold tabular-nums tracking-tight text-emerald-400 sm:text-4xl">
                  <AnimatedAmount value={3370} />
                </p>
              </div>
              <div className="min-w-[9rem]">
                <div className="flex items-center justify-between text-[11px] text-white/45">
                  <span>Pagado</span>
                  <span className="font-mono tabular-nums text-white/70">58%</span>
                </div>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-[58%] rounded-l-full bg-emerald-500" />
                  <div className="h-full w-[42%] bg-amber-400" />
                </div>
                <div className="mt-1.5 flex gap-3 text-[9px] text-white/40">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Listo
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Pendiente
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { name: 'Nómina', amount: '+$12,000', tone: 'text-emerald-400', paid: true },
                { name: 'Freelance', amount: '+$3,500', tone: 'text-emerald-400', paid: true },
                { name: 'Renta', amount: '-$8,500', tone: 'text-white/80', paid: true },
                { name: 'Despensa', amount: '-$2,180', tone: 'text-white/80', paid: false },
                { name: 'Tarjeta', amount: '-$1,450', tone: 'text-white/80', paid: false },
                { name: 'Luz', amount: '-$1,000', tone: 'text-white/80', paid: false },
              ].map((row) => (
                <div
                  key={row.name}
                  className={cn(
                    'flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5',
                    row.paid ? 'bg-white/[0.02] opacity-75' : 'bg-white/[0.03]'
                  )}
                >
                  <span className="text-xs text-white/80">{row.name}</span>
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

          <div className="space-y-3 p-4 sm:p-6">
            <div className="rounded-lg border border-white/10 border-l-[3px] border-l-emerald-500/50 bg-transparent px-3 py-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
                  <LineChart className="h-3.5 w-3.5 text-emerald-400" aria-hidden data-icon="inline-start" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                    Disponible
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
                    <AnimatedAmount value={18450} durationMs={1600} />
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-md border border-white/10 bg-[#161616] px-2.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <WalletProviderIcon
                      providerIconKey="BBVA"
                      className="h-5 w-5"
                      showTooltipLabel={false} data-icon="inline-start" />
                    <p className="truncate text-[11px] text-white/55">BBVA Débito</p>
                  </div>
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-white">
                    $12,200
                  </p>
                </div>
                <div className="rounded-md border border-white/10 bg-[#161616] px-2.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <WalletProviderIcon
                      providerIconKey="CASH_GENERIC"
                      className="h-5 w-5"
                      showTooltipLabel={false} data-icon="inline-start" />
                    <p className="truncate text-[11px] text-white/55">Efectivo</p>
                  </div>
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-white">
                    $6,250
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MetricStrip
                label="Ingresos"
                value="$24,000"
                border="border-l-blue-500/50"
                tone="text-blue-300"
              />
              <MetricStrip
                label="Gastos"
                value="$11,380"
                border="border-l-violet-500/50"
                tone="text-violet-300"
              />
              <MetricStrip
                label="Pendiente"
                value="$3,420"
                border="border-l-amber-500/50"
                tone="text-amber-300"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'liquidity') {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-white/10 bg-[#0d1327] text-left shadow-[0_24px_60px_-36px_rgba(58,55,252,0.4)]',
          className
        )}
        role="img"
        aria-label="Vista previa de proyección de liquidez a 180 días"
      >
        <AppChrome
          title="Liquidez"
          subtitle="Proyección a 180 días · efectivo y débito"
        />
        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <LineChart className="h-4 w-4 text-emerald-400" aria-hidden data-icon="inline-start" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                Punto más bajo
              </p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-amber-300">
                <AnimatedAmount value={4820} decimals={0} />
              </p>
              <p className="mt-1 text-xs text-white/45">
                12 sep · después de colegiatura y corte MP
              </p>
            </div>
          </div>

          <LiquidityChart />

          <div className="grid grid-cols-3 gap-2">
            <MetricStrip label="Hoy" value="$18.4k" border="border-l-emerald-500/50" />
            <MetricStrip label="30 días" value="$11.2k" border="border-l-blue-500/50" />
            <MetricStrip label="180 días" value="$9.6k" border="border-l-amber-500/50" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-xl border border-white/10 bg-[#0d1327] text-left shadow-[0_24px_60px_-36px_rgba(58,55,252,0.4)]',
          className
        )}
        role="img"
        aria-label="Vista previa de tarjetas y cuotas pendientes"
      >
        <AppChrome title="Mis tarjetas" subtitle="2 tarjetas · ciclo actual" />
        <div className="space-y-3 p-4 sm:p-5">
          {[
            {
              name: 'Mercado Pago',
              providerIconKey: 'MERCADO_PAGO',
              due: 'Corte 28 jul',
              used: '$6,840',
              limit: 'de $15,000',
              min: 'Mínimo $820',
              usedPct: 46,
              accent: 'from-[#0ea5e9]/30 to-[#0ea5e9]/5',
            },
            {
              name: 'DiDi Card',
              providerIconKey: 'DIDI',
              due: 'Corte 5 ago',
              used: '$2,150',
              limit: 'de $8,000',
              min: 'Mínimo $340',
              usedPct: 27,
              accent: 'from-[#ea580c]/30 to-[#ea580c]/5',
            },
          ].map((card) => (
            <div
              key={card.name}
              className={cn(
                'rounded-xl border border-white/10 bg-linear-to-br p-3.5',
                card.accent
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <WalletProviderIcon
                    providerIconKey={card.providerIconKey}
                    className="h-7 w-7"
                    showTooltipLabel={false} data-icon="inline-start" />
                  <div>
                    <p className="text-sm font-semibold text-white">{card.name}</p>
                    <p className="text-[11px] text-white/45">{card.due}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-bold tabular-nums text-white">
                    {card.used}
                  </p>
                  <p className="text-[10px] text-white/40">{card.limit}</p>
                </div>
              </div>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-black/30">
                <div
                  className="h-full rounded-full bg-white/80"
                  style={{ width: `${card.usedPct}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-white/55">{card.min}</p>
            </div>
          ))}

          <div className="rounded-lg border border-white/10 border-l-[3px] border-l-violet-500/50 bg-white/[0.03] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Cuota activa
            </p>
            <p className="mt-1 text-sm text-white/80">
              Laptop · 4/12 ·{' '}
              <span className="font-mono font-semibold tabular-nums text-white">
                $1,190
              </span>
              /mes
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-white/10 bg-[#0d1327] text-left',
        className
      )}
      role="img"
      aria-label="Vista previa de MiCasa"
    >
      <AppChrome title="MiCasa" />
      <div className="p-5">
        <p className="font-mono text-xl font-bold tabular-nums text-emerald-400">
          $3,370.00
        </p>
      </div>
    </div>
  );
};
