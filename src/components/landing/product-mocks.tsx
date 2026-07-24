import { cn } from '@/lib/utils';

type ProductMockProps = {
  className?: string;
  variant?: 'fortnight' | 'wallets' | 'dashboard';
};

/** Static UI frames used as landing “screenshots” (no live data). */
export const ProductMock = ({
  className,
  variant = 'fortnight',
}: ProductMockProps) => {
  if (variant === 'wallets') {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-white/10 bg-[#121212] text-left shadow-2xl shadow-black/40',
          className
        )}
        role="img"
        aria-label="Vista previa de billeteras y saldo disponible"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-[11px] text-white/45">Billeteras</span>
        </div>
        <div className="space-y-3 p-4">
          <div className="rounded-xl border border-border/40 border-l-[3px] border-l-emerald-500/60 bg-white/[0.03] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Disponible
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
              $18,450.00
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { name: 'BBVA Débito', amount: '$12,200.00', accent: 'blue' },
              { name: 'Efectivo', amount: '$6,250.00', accent: 'emerald' },
            ].map((wallet) => (
              <div
                key={wallet.name}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <p className="truncate text-xs font-medium text-white/80">
                  {wallet.name}
                </p>
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

  if (variant === 'dashboard') {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-2xl border border-white/10 bg-[#121212] text-left shadow-2xl shadow-black/40',
          className
        )}
        role="img"
        aria-label="Vista previa del panel con ingresos, gastos y obligaciones"
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-[11px] text-white/45">Inicio</span>
        </div>
        <div className="grid gap-2 p-4 sm:grid-cols-3">
          {[
            {
              label: 'Ingresos',
              value: '$24,000',
              border: 'border-l-blue-500/60',
            },
            {
              label: 'Gastos',
              value: '$11,380',
              border: 'border-l-violet-500/60',
            },
            {
              label: 'Pendiente',
              value: '$3,420',
              border: 'border-l-amber-500/60',
            },
          ].map((metric) => (
            <div
              key={metric.label}
              className={cn(
                'rounded-lg border border-white/10 border-l-[3px] bg-white/[0.03] px-3 py-2.5',
                metric.border
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                {metric.label}
              </p>
              <p className="mt-1 font-mono text-sm font-bold tabular-nums text-white">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[58%] bg-emerald-500" />
            <div className="h-full w-[22%] bg-amber-400" />
            <div className="h-full w-[20%] bg-violet-500" />
          </div>
          <p className="mt-2 text-[11px] text-white/45">
            Quincena en curso · proyección a 180 días
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-white/10 bg-[#121212] text-left shadow-2xl shadow-black/40',
        className
      )}
      role="img"
      aria-label="Vista previa del planificador por quincenas"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        <span className="ml-2 text-[11px] text-white/45">
          Quincena · 1–15 jul
        </span>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-300/80">
            Ingresos
          </p>
          {[
            { name: 'Nómina', amount: '+$12,000' },
            { name: 'Freelance', amount: '+$3,500' },
          ].map((row) => (
            <div
              key={row.name}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              <span className="text-xs text-white/80">{row.name}</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-emerald-400">
                {row.amount}
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/80">
            Gastos
          </p>
          {[
            { name: 'Renta', amount: '-$8,500', paid: true },
            { name: 'Despensa', amount: '-$2,180', paid: false },
            { name: 'Tarjeta', amount: '-$1,450', paid: false },
          ].map((row) => (
            <div
              key={row.name}
              className={cn(
                'flex items-center justify-between rounded-lg border border-white/10 px-3 py-2',
                row.paid ? 'bg-white/[0.02] opacity-70' : 'bg-white/[0.03]'
              )}
            >
              <span className="text-xs text-white/80">{row.name}</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-white">
                {row.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Balance quincena
            </p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-400">
              $3,370.00
            </p>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-[10px] text-white/45">Pagado 58% · Pendiente 42%</p>
            <div className="mt-1.5 flex h-1.5 w-36 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-[58%] rounded-l-full bg-emerald-500" />
              <div className="h-full w-[42%] bg-amber-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
