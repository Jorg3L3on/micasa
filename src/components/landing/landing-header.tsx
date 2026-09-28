'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { MicasaMark } from '@/components/brand/micasa-mark';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';

const NAV = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#producto', label: 'Producto' },
  { href: '#quincena', label: 'Quincena' },
  { href: '#importar', label: 'Importar' },
] as const;

export const LandingHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleToggleMenu = () => {
    setMenuOpen((open) => !open);
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link
          href="#inicio"
          className="inline-flex min-w-0 items-center gap-2 text-foreground"
          aria-label="MiCasa inicio"
          onClick={handleCloseMenu}
        >
          <MicasaMark className="size-8" />
          <span className="truncate text-section">MiCasa</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Secciones">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-body text-muted-foreground transition-colors duration-(--motion-fast) ease-(--ease-out-soft) hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button variant="ghost" className="hidden sm:inline-flex" asChild>
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Empezar</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            onClick={handleToggleMenu}
          >
            {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </Button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          className="border-t border-border/60 px-4 py-3 md:hidden"
          aria-label="Secciones"
        >
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-xl px-3 py-2 text-body text-foreground hover:bg-accent"
                  onClick={handleCloseMenu}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/login"
                className="block rounded-xl px-3 py-2 text-body text-foreground hover:bg-accent sm:hidden"
                onClick={handleCloseMenu}
              >
                Iniciar sesión
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
};
