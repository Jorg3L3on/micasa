import { cn } from '@/lib/utils';

type ProductMockProps = {
  className?: string;
  variant?: 'fortnight' | 'wallets' | 'dashboard' | 'hero';
};

const WindowChrome = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
    <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
    <span className="ml-2 text-[11px] text-white/45">{label}</span>
  </div>
);

/** Static UI frames used as landing “screenshots” (no live data). */
export const ProductMock = ({
  className,
  variant = 'fortnight',
}: ProductMockProps) => {
  if (variant === 'hero') {
    return (
      <div
        className={cn(
          'overflow-hidden border-y border-white/10 bg-[#0e1118] text-left shadow-[0_-24px_80px_-20px_rgba(15,23,42,0.45)]',
          className
        )}
        role="img"
        aria-label="Vista previa del planificador por quincenas de MiCasa"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium tracking-wide text-white/50">
              Quincena · 1–15 jul
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" />
            <span className="hidden text-xs text-white/35 sm:inline">
              Casa León
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-white/40">
            <span>Ingresos</span>
            <span className="text-white/70">Gastos</span>
            <span>Balance</span>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3 border-b border-white/10 p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                  Balance quincena
                </p>
                <p className="mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight text-emerald-400 sm:text-4xl">
                  $3,370.00
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

          <div className="space-y-4 p-5 sm:p-8">
            <div className="border border-white/[0.06] border-l-[3px] border-l-emerald-500/60 bg-white/[0.03] px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                Disponible
              </p>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">
                $18,450.00
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="border border-white/10 bg-black/20 px-3 py-2">
                  <p className="truncate text-[11px] text-white/55">BBVA Débito</p>
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-white">
                    $12,200
                  </p>
                </div>
                <div className="border border-white/10 bg-black/20 px-3 py-2">
                  <p className="truncate text-[11px] text-white/55">Efectivo</p>
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-white">
                    $6,250
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Ingresos', value: '$24,000', border: 'border-l-blue-500/60' },
                { label: 'Gastos', value: '$11,380', border: 'border-l-[#2E8DF5]/60' },
                { label: 'Pendiente', value: '$3,420', border: 'border-l-amber-500/60' },
              ].map((metric) => (
                <div
                  key={metric.label}
                  className={cn(
                    'border border-white/10 border-l-[3px] bg-white/[0.03] px-2.5 py-2.5',
                    metric.border
                  )}
                >
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
                    {metric.label}
                  </p>
                  <p className="mt-1 font-mono text-xs font-bold tabular-nums text-white sm:text-sm">
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

  if (variant === 'wallets') {
    return (
      <div
        className={cn(
          'overflow-hidden border border-white/10 bg-[#121212] text-left',
          className
        )}
        role="img"
        aria-label="Vista previa de billeteras y saldo disponible"
      >
        <WindowChrome label="Billeteras" />
        <div className="space-y-3 p-4">
          <div className="border border-border/40 border-l-[3px] border-l-emerald-500/60 bg-white/[0.03] px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
              Disponible
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-white">
              $18,450.00
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
          'overflow-hidden border border-white/10 bg-[#121212] text-left',
          className
        )}
        role="img"
        aria-label="Vista previa del panel con ingresos, gastos y obligaciones"
      >
        <WindowChrome label="Inicio" />
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
              border: 'border-l-[#2E8DF5]/60',
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
                'border border-white/10 border-l-[3px] bg-white/[0.03] px-3 py-2.5',
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
            <div className="h-full w-[20%] bg-[#2E8DF5]" />
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
        'overflow-hidden border border-white/10 bg-[#121212] text-left',
        className
      )}
      role="img"
      aria-label="Vista previa del planificador por quincenas"
    >
      <WindowChrome label="Quincena · 1–15 jul" />
      <div className="grid gap-3 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/80">
            Ingresos
          </p>
          {[
            { name: 'Nómina', amount: '+$12,000' },
            { name: 'Freelance', amount: '+$3,500' },
          ].map((row) => (
            <div
              key={row.name}
              className="flex items-center justify-between border border-white/10 bg-white/[0.03] px-3 py-2"
            >
              <span className="text-xs text-white/80">{row.name}</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-emerald-400">
                {row.amount}
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-200/70">
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
                'flex items-center justify-between border border-white/10 px-3 py-2',
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
