import Link from 'next/link';

import { MicasaMark } from '@/components/brand/micasa-mark';
import { FortnightScrub } from '@/components/landing/fortnight-scrub';
import { LandingAtmosphere } from '@/components/landing/landing-atmosphere';
import { LandingHeader } from '@/components/landing/landing-header';
import { ProductShot, type ProductShotId } from '@/components/landing/product-shot';
import { Button } from '@/components/ui/button';

type ProductSection = {
  id: ProductShotId;
  eyebrow: string;
  title: string;
  body: string;
  alt: string;
};

const PRODUCTS: ProductSection[] = [
  {
    id: 'billeteras',
    eyebrow: 'Billeteras',
    title: 'Efectivo, débito y tarjeta',
    body: 'Cada billetera muestra el dinero que sí puedes usar. El crédito no se mezcla con el efectivo.',
    alt: 'Billeteras de Hogar: Efectivo, Débito casa, Tarjeta del hogar, Tarjeta digital y Tienda del hogar.',
  },
  {
    id: 'liquidez',
    eyebrow: 'Análisis · Liquidez',
    title: 'Hasta dónde alcanza',
    body: 'La pestaña Liquidez proyecta el efectivo hacia adelante, con cortes y préstamos ya contemplados.',
    alt: 'Análisis, pestaña Liquidez: gráfica Deudas por mes con Préstamo del hogar, Tarjeta del hogar y Refrigerador.',
  },
  {
    id: 'plan',
    eyebrow: 'Análisis · Plan',
    title: 'Dónde conviene el extra',
    body: 'La pestaña Plan dice si el periodo cuadra y cómo cubrir lo que falta.',
    alt: 'Análisis en la pestaña Plan, con el reparto del dinero extra.',
  },
  {
    id: 'prestamos',
    eyebrow: 'Préstamos',
    title: 'El contrato y cada cuota',
    body: 'Un préstamo con calendario, lo pagado y lo que sigue, ligado a la quincena.',
    alt: 'Préstamos de Hogar: Préstamo del hogar con Caja del barrio, Refrigerador con Fondo vecinal y Bicicleta con Taller Norte.',
  },
  {
    id: 'metas',
    eyebrow: 'Metas',
    title: 'Apartar sin perder el hilo',
    body: 'Una meta es una billetera con monto objetivo. El avance vive junto al resto del dinero.',
    alt: 'Metas de Hogar: Viaje, Reserva y Colchón, cada una con lo ahorrado y el monto objetivo.',
  },
  {
    id: 'operaciones',
    eyebrow: 'Operaciones',
    title: 'Cada movimiento, en orden',
    body: 'Gastos, ingresos y pagos quedan como movimientos en Operaciones.',
    alt: 'Operaciones de Hogar con Salario de $18,500 y movimientos de Despensa, Luz y Transporte.',
  },
  {
    id: 'toca-pagar',
    eyebrow: 'Toca pagar',
    title: 'Lo que sigue en esa quincena',
    body: 'Cuando miras una quincena que no es la de hoy, el panel marca lo que toca pagar.',
    alt: 'Resumen de quincena con la etiqueta Toca pagar.',
  },
];

export const LandingPage = () => {
  return (
    <div className="landing-root relative min-h-svh overflow-x-clip bg-background text-foreground">
      <LandingAtmosphere />
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-card focus:px-3 focus:py-2 focus:text-body focus:shadow-card"
      >
        Saltar al contenido
      </a>
      <LandingHeader />

      <main id="contenido">
        <section id="inicio" className="relative mx-auto w-full max-w-6xl scroll-mt-[calc(3.5rem+env(safe-area-inset-top))] px-4 pt-10 pb-16 sm:px-6 md:pt-16">
          <div className="landing-hero-wash relative overflow-hidden px-5 py-8 sm:px-8 sm:py-10">
            <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <div className="motion-fade-in min-w-0">
                <p className="eyebrow text-muted-foreground">Planeación por quincenas</p>
                <h1 className="mt-3 text-balance text-display">
                  Tu quincena, clara de punta a punta
                </h1>
                <p className="mt-4 max-w-xl text-body text-muted-foreground">
                  Organiza ingresos, gastos, billeteras y préstamos al ritmo de cobrar y pagar.
                  Personal o en casa.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  <Button size="lg" asChild>
                    <Link href="/register">Crear cuenta</Link>
                  </Button>
                  <Button variant="ghost" size="lg" asChild>
                    <Link href="#producto">Ver el producto</Link>
                  </Button>
                </div>
              </div>
              <div className="min-w-0">
                <p className="eyebrow mb-3 text-muted-foreground">Panel</p>
                <ProductShot
                  id="panel"
                  priority
                  alt="Panel financiero con el resumen de la quincena y las billeteras."
                />
              </div>
            </div>
          </div>
        </section>

        <div id="producto" className="mx-auto flex w-full max-w-6xl scroll-mt-[calc(3.5rem+env(safe-area-inset-top))] flex-col gap-16 px-4 pb-8 sm:px-6 md:gap-20">
          {PRODUCTS.map((section) => (
            <section key={section.id} className="grid items-center gap-6 md:grid-cols-2 md:gap-10">
              <div className="min-w-0">
                <p className="eyebrow text-muted-foreground">{section.eyebrow}</p>
                <h2 className="mt-2 text-title">{section.title}</h2>
                <p className="mt-3 max-w-prose text-body text-muted-foreground">{section.body}</p>
              </div>
              <ProductShot id={section.id} alt={section.alt} className="min-w-0" />
            </section>
          ))}
        </div>

        <section id="estado-de-cuenta" className="mx-auto w-full max-w-6xl scroll-mt-[calc(3.5rem+env(safe-area-inset-top))] px-4 py-16 sm:px-6">
          <div className="max-w-2xl">
            <p className="eyebrow text-muted-foreground">Estado de cuenta</p>
            <h2 className="mt-2 text-title">Importa el estado de cuenta</h2>
            <p className="mt-3 text-body text-muted-foreground">
              En la tarjeta, Más → Estado de cuenta abre Importar estado de cuenta. Subes el PDF,
              revisas los movimientos y confirmas. No hay conexión al banco: el archivo lo traes tú.
            </p>
            <p className="mt-3 text-caption text-muted-foreground">
              Opcional: en Configuración → Conexiones puedes dar acceso a un agente. La app sola
              basta para planear la quincena.
            </p>
          </div>
        </section>

        <section id="quincena" className="mx-auto w-full max-w-6xl scroll-mt-[calc(3.5rem+env(safe-area-inset-top))] px-4 pb-16 sm:px-6" aria-labelledby="quincena-titulo">
          <div className="max-w-2xl">
            <p className="eyebrow text-muted-foreground">Quincena</p>
            <h2 id="quincena-titulo" className="mt-2 text-title">
              De un cobro al siguiente
            </h2>
            <p className="mt-3 text-body text-muted-foreground">
              La primera va del último día del mes anterior al 14. La segunda, del 15 al penúltimo. El
              último día pertenece a la primera del mes que sigue.
            </p>
          </div>
          <div className="mt-6">
            <FortnightScrub />
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
          <div className="landing-hero-wash px-5 py-10 text-center sm:px-8">
            <h2 className="text-title">Empieza por la quincena de este mes</h2>
            <p className="mx-auto mt-3 max-w-xl text-body text-muted-foreground">
              Gratis para usar. Crea la cuenta y arma la casa, o quédate en lo personal.
            </p>
            <div className="mt-6">
              <Button size="lg" asChild>
                <Link href="/register">Crear cuenta</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="inline-flex items-center gap-2">
            <MicasaMark className="size-6" />
            <span className="text-caption text-muted-foreground">MiCasa</span>
          </div>
          <nav className="flex flex-wrap gap-x-4 gap-y-2" aria-label="Legal">
            <Link className="text-caption text-muted-foreground hover:text-foreground" href="/privacy">
              Aviso de privacidad
            </Link>
            <Link className="text-caption text-muted-foreground hover:text-foreground" href="/terms">
              Términos de uso
            </Link>
            <Link className="text-caption text-muted-foreground hover:text-foreground" href="/login">
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};
