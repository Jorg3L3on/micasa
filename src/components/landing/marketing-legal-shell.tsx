import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';

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
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="inline-flex items-center" aria-label="MiCasa inicio">
            <Image
              src="/logo-black.svg"
              alt="MiCasa"
              width={140}
              height={44}
              className="h-9 w-auto dark:hidden"
              unoptimized
            />
            <Image
              src="/logo-white.svg"
              alt="MiCasa"
              width={140}
              height={44}
              className="hidden h-9 w-auto dark:block"
              unoptimized
            />
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link href="/register">Crear cuenta</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10 md:py-14">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {updatedLabel}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="prose-legal mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-10 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-x-5 gap-y-2 px-6 py-6 text-sm text-muted-foreground">
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
