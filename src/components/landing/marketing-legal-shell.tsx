import type { ReactNode } from 'react';
import Link from 'next/link';

import { MicasaMark } from '@/components/brand/micasa-mark';

type MarketingLegalShellProps = {
  title: string;
  updatedLabel: string;
  children: ReactNode;
};

export const MarketingLegalShell = ({
  title,
  updatedLabel,
  children,
}: MarketingLegalShellProps) => {
  return (
    <div className="landing-root min-h-svh bg-[#060914] text-white">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 text-white transition-opacity hover:opacity-90"
            aria-label="MiCasa inicio"
          >
            <MicasaMark className="h-7 w-auto" />
            <span className="text-base font-semibold tracking-tight">
              MiCasa
            </span>
          </Link>
          <Link
            href="/register"
            className="landing-cta inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-white hover:brightness-110"
          >
            Crear cuenta
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10 md:py-14">
        <p className="text-xs font-medium uppercase tracking-wider text-white/45">
          {updatedLabel}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-white/55 [&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
      </main>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-x-5 gap-y-2 px-6 py-6 text-sm text-white/40">
          <Link className="hover:text-white/80" href="/">
            Inicio
          </Link>
          <Link className="hover:text-white/80" href="/privacy">
            Aviso de privacidad
          </Link>
          <Link className="hover:text-white/80" href="/terms">
            Términos de uso
          </Link>
          <Link className="hover:text-white/80" href="/login">
            Iniciar sesión
          </Link>
        </div>
      </footer>
    </div>
  );
};
