import type { ReactNode } from 'react';
import Link from 'next/link';

import { MicasaMark } from '@/components/brand/micasa-mark';
import { Button } from '@/components/ui/button';

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
    <div className="landing-root min-h-svh bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-w-0 items-center gap-2 text-foreground"
            aria-label="MiCasa inicio"
          >
            <MicasaMark className="size-7" />
            <span className="truncate text-section">MiCasa</span>
          </Link>
          <Button asChild>
            <Link href="/register">Crear cuenta</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 md:py-14">
        <p className="overline text-muted-foreground">{updatedLabel}</p>
        <h1 className="mt-2 text-display">{title}</h1>
        <div className="mt-8 space-y-6 text-body text-muted-foreground [&_h2]:mt-10 [&_h2]:text-section [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-x-5 gap-y-2 px-4 py-6 text-caption text-muted-foreground sm:px-6">
          <Link className="hover:text-foreground" href="/">
            Inicio
          </Link>
          <Link className="hover:text-foreground" href="/privacy">
            Aviso de privacidad
          </Link>
          <Link className="hover:text-foreground" href="/terms">
            Términos de uso
          </Link>
          <Link className="hover:text-foreground" href="/login">
            Iniciar sesión
          </Link>
        </div>
      </footer>
    </div>
  );
};
