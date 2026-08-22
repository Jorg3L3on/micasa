'use client';

import { useSession } from 'next-auth/react';
import { Waves } from 'lucide-react';

export const LiquidityWelcome = () => {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0];

  return (
    <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-card px-4 py-5 sm:px-6 sm:py-6 dark:border-white/[0.08] dark:bg-[#0d1327]/70 dark:shadow-[0_24px_80px_-48px_rgba(58,55,252,0.4)] dark:backdrop-blur-xl">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-[#3a37fc]/30 to-[#ee477a]/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 left-1/3 h-28 w-28 rounded-full bg-emerald-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3a37fc]/20 to-[#ee477a]/10 text-primary ring-1 ring-primary/25"
          aria-hidden
        >
          <Waves className="size-4" />
        </span>
        <div className="min-w-0">
          {firstName ? (
            <p className="text-sm text-muted-foreground">
              Hola, <span className="font-medium text-foreground">{firstName}</span>
            </p>
          ) : null}
          <h1 className="mt-0.5 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
            <span className="bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent dark:from-white dark:via-white dark:to-white/70">
              Liquidez
            </span>{' '}
            <span className="bg-gradient-to-r from-[#3a37fc] to-[#ee477a] bg-clip-text text-transparent">
              y proyección
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Panorama de deudas, cuentas y gastos en un solo lugar.
          </p>
        </div>
      </div>
    </header>
  );
};
