import Link from 'next/link';

import { MicasaMark } from '@/components/brand/micasa-mark';

const NAV = [
  { href: '#quincena', label: 'La quincena' },
  { href: '#producto', label: 'Producto' },
  { href: '#casa', label: 'En casa' },
  { href: '#preguntas', label: 'Preguntas' },
] as const;

/**
 * Floating glass pill. Section links hide under 900px, Iniciar sesión under 520px.
 * The slot is a zero-height sticky box, so the pill floats over the hero.
 */
export const LandingHeader = () => {
  return (
    <div className="mc-header-slot">
      <header className="mc-header">
        <a href="#inicio" className="mc-brand" aria-label="MiCasa, inicio">
          <MicasaMark className="mc-brand-mark" priority />
          <span className="mc-brand-name">MiCasa</span>
        </a>

        <nav className="mc-nav" aria-label="Secciones">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="mc-header-actions">
          <Link href="/login" className="mc-login">
            Iniciar sesión
          </Link>
          <Link href="/register" className="mc-cta">
            Crear cuenta
          </Link>
        </div>
      </header>
    </div>
  );
};
