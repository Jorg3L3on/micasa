'use client';

import { useId } from 'react';
import { LineChart, QrCode, Search } from 'lucide-react';

import { AnimatedAmount } from '@/components/landing/animated-amount';
import { MicasaMark } from '@/components/brand/micasa-mark';
import { WalletProviderIcon } from '@/components/wallets/WalletProviderIcon';
import { cn } from '@/lib/utils';

const WALLETS = [
  { name: 'BBVA Nómina', key: 'BBVA', amount: '$12,200' },
  { name: 'Efectivo', key: 'CASH_GENERIC', amount: '$6,250' },
  { name: 'Mercado Pago', key: 'MERCADO_PAGO', amount: '$6,840' },
] as const;

const ROWS = [
  { name: 'Nómina', kind: 'Ingreso', status: 'Activo', amount: '+$12,000', tone: 'emerald' },
  { name: 'Renta', kind: 'Gasto', status: 'Pagado', amount: '-$8,500', tone: 'slate' },
  { name: 'Despensa', kind: 'Gasto', status: 'Pendiente', amount: '-$2,180', tone: 'amber' },
  { name: 'Tarjeta MP', kind: 'Crédito', status: 'Prospecto', amount: '-$1,450', tone: 'amber' },
] as const;

const STATUS_CLASS: Record<(typeof ROWS)[number]['status'], string> = {
  Activo: 'bg-emerald-500/15 text-emerald-300',
  Pagado: 'bg-emerald-500/15 text-emerald-300',
  Pendiente: 'bg-amber-400/15 text-amber-200',
  Prospecto: 'bg-orange-500/15 text-orange-200',
};

const RadarChart = ({ gradientId }: { gradientId: string }) => (
  <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden>
    <defs>
      <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3a37fc" />
        <stop offset="100%" stopColor="#ee477a" />
      </linearGradient>
    </defs>
    {[18, 36, 54].map((r) => (
      <polygon
        key={r}
        points="80,20 132,50 132,110 80,140 28,110 28,50"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="1"
        transform={`translate(80 80) scale(${r / 54}) translate(-80 -80)`}
      />
    ))}
    <polygon
      points="80,34 118,58 110,108 80,126 48,104 42,62"
      fill={`url(#${gradientId})`}
      fillOpacity="0.18"
      stroke={`url(#${gradientId})`}
      strokeWidth="1.5"
    />
  </svg>
);

const EarningsGauge = ({ gradientId }: { gradientId: string }) => (
  <svg viewBox="0 0 200 112" className="h-24 w-full" aria-hidden>
    <defs>
      <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#3a37fc" />
        <stop offset="55%" stopColor="#911efe" />
        <stop offset="100%" stopColor="#ee477a" />
      </linearGradient>
    </defs>
    <path
      d="M18 100 A82 82 0 0 1 182 100"
      fill="none"
      stroke="rgba(255,255,255,0.08)"
      strokeWidth="10"
      strokeLinecap="round"
    />
    <path
      d="M18 100 A82 82 0 0 1 182 100"
      fill="none"
      stroke={`url(#${gradientId})`}
      strokeWidth="10"
      strokeLinecap="round"
      strokeDasharray="180 260"
    />
  </svg>
);

type HeroDashboardMockProps = {
  className?: string;
};

/** Decorative product frame — Orion-style glass dashboard with MiCasa data. */
export const HeroDashboardMock = ({ className }: HeroDashboardMockProps) => {
  const reactId = useId().replace(/:/g, '');
  const radarGradientId = `landingRadar-${reactId}`;
  const gaugeGradientId = `landingGauge-${reactId}`;
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#090e1d]/90 text-left shadow-[0_40px_120px_-36px_rgba(58,55,252,0.55)] backdrop-blur-xl',
        className
      )}
      role="img"
      aria-label="Vista previa del panel financiero de MiCasa"
    >
      <div
        aria-hidden
        className="h-px w-full bg-linear-to-r from-transparent via-[#911efe]/80 to-transparent"
      />

      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <span className="flex gap-1" aria-hidden>
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
            <span className="size-2 rounded-full bg-white/15" />
          </span>
          <span className="hidden text-[11px] text-white/45 sm:inline">Panel financiero</span>
        </div>
        <div className="hidden items-center gap-3 text-[11px] text-white/40 md:flex">
          {['Inicio', 'Quincena', 'Liquidez', 'Tarjetas'].map((item, index) => (
            <span
              key={item}
              className={cn(index === 0 && 'rounded-full bg-white/10 px-2 py-0.5 text-white')}
            >
              {item}
            </span>
          ))}
        </div>
        <div className="flex size-7 items-center justify-center rounded-full bg-linear-to-br from-[#3a37fc] to-[#ee477a] text-[10px] font-bold text-white">
          JL
        </div>
      </div>

      <div className="grid lg:grid-cols-[13rem_1fr]">
        <aside className="hidden border-r border-white/[0.06] bg-black/20 p-3 lg:block">
          <div className="mb-3 flex items-center gap-2 px-1">
            <MicasaMark className="h-5 w-auto" />
            <span className="text-sm font-semibold tracking-tight text-white">micasa</span>
          </div>
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/40">
            <Search className="size-3" aria-hidden />
            Buscar…
          </div>
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Mis billeteras
          </p>
          <ul className="mt-2 space-y-1.5">
            {WALLETS.map((wallet) => (
              <li
                key={wallet.name}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <WalletProviderIcon
                    providerIconKey={wallet.key}
                    className="h-5 w-5 border-white/10 bg-white/5"
                    showTooltipLabel={false}
                  />
                  <span className="truncate text-[11px] text-white/75">{wallet.name}</span>
                </span>
                <span className="font-mono text-[10px] tabular-nums text-white/55">
                  {wallet.amount}
                </span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs text-white/45">Hola, Jorge</p>
              <p className="font-[family-name:var(--font-landing-display)] text-lg font-semibold tracking-tight text-white sm:text-xl">
                Welcome Back
              </p>
            </div>
            <p className="text-[11px] text-white/40">Quincena · 30 jun–14 jul 2026</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Balance quincena
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold tabular-nums tracking-tight text-white sm:text-3xl">
                      <AnimatedAmount value={3370} />
                    </p>
                  </div>
                  <div className="min-w-[7.5rem]">
                    <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full w-[58%] rounded-l-full bg-emerald-400" />
                      <div className="h-full w-[42%] bg-amber-400" />
                    </div>
                    <p className="mt-1 text-right font-mono text-[10px] tabular-nums text-white/45">
                      58% listo
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-white/[0.07]">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-white/[0.03] text-white/40">
                    <tr>
                      <th className="px-3 py-2 font-medium">Movimiento</th>
                      <th className="hidden px-3 py-2 font-medium sm:table-cell">Tipo</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 text-right font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((row) => (
                      <tr key={row.name} className="border-t border-white/[0.06]">
                        <td className="px-3 py-2 text-white/85">{row.name}</td>
                        <td className="hidden px-3 py-2 text-white/45 sm:table-cell">{row.kind}</td>
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                              STATUS_CLASS[row.status]
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 text-right font-mono tabular-nums',
                            row.tone === 'emerald' && 'text-emerald-300',
                            row.tone === 'amber' && 'text-amber-200',
                            row.tone === 'slate' && 'text-white/70'
                          )}
                        >
                          {row.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-linear-to-br from-[#3a37fc]/25 via-[#0d1327] to-[#ee477a]/20 p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/50">
                      Linked Card
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-white/45">4928 **** 0012</p>
                  </div>
                  <QrCode className="size-8 text-white/70" aria-hidden />
                </div>
                <p className="mt-4 font-mono text-2xl font-bold tabular-nums text-white">
                  <AnimatedAmount value={18450} durationMs={1600} />
                </p>
                <p className="mt-1 text-[11px] text-emerald-300">+$43,384 disponible</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                  <p className="text-[10px] uppercase tracking-wider text-white/40">Earnings</p>
                  <EarningsGauge gradientId={gaugeGradientId} />
                  <p className="mt-1 text-center font-mono text-sm font-bold tabular-nums text-white">
                    $3,370
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <LineChart className="size-3 text-[#911efe]" aria-hidden />
                    <p className="text-[10px] uppercase tracking-wider text-white/40">Flujo</p>
                  </div>
                  <div className="h-[4.75rem]">
                    <RadarChart gradientId={radarGradientId} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
