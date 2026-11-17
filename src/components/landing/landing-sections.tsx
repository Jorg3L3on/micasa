import './landing-sections.css';

import Link from 'next/link';

import { formatPesos } from '@/components/landing/landing-data';
import {
  ContextSwitch,
  DayGrid,
  MonthCompare,
  PanelDemo,
  PurchaseSimulator,
} from '@/components/landing/landing-widgets';

const BAND_WORDS = 'Renta · Súper · Luz · Tarjeta · Colegiatura · Préstamo · Ahorro · Internet · ';

/** Outlined words sliding left. Decorative. */
export const WordBand = () => {
  return (
    <div className="mc-band" aria-hidden="true">
      <div className="mc-marq">
        {BAND_WORDS}
        {BAND_WORDS}
      </div>
    </div>
  );
};

export const QuincenaSection = () => {
  return (
    <section id="quincena" className="mc-section mc-quincena">
      <h2 className="mc-eyebrow">Por qué quincenas</h2>
      <p className="mc-statement mc-view">
        <span className="mc-w mc-w1">
          Las apps de finanzas cuentan <strong>meses.</strong>
        </span>{' '}
        <span className="mc-w mc-w2">
          Tú cobras <strong>cada quince días.</strong>
        </span>{' '}
        <span className="mc-w mc-w3">
          La renta sale en una mitad, la tarjeta en la otra, y lo que sobra de una no siempre
          llega a la siguiente.
        </span>
      </p>
      <MonthCompare />
      <DayGrid />
    </section>
  );
};

const PROJECTION_POINTS =
  '0,120 0,60 50,110 50,52 100,112 100,58 150,128 150,76 200,150 200,100 250,168 250,120 300,176 300,118 350,150 350,92 400,128 400,70 450,112 450,56 500,104 500,48 550,98 550,44 600,92';

const TILES = [
  {
    title: 'Préstamos',
    text: 'El contrato completo y cada cuota en su quincena.',
    color: '#8f9bff',
    icon: <path d="M4 19V5M4 19h16M8 15v-4M12 15V8M16 15v-6" />,
  },
  {
    title: 'Metas',
    text: 'Aparta para lo que quieres sin perder de vista lo que debes.',
    color: '#e08cff',
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 12h.01" />
      </>
    ),
  },
  {
    title: 'Estado de cuenta',
    text: 'Subes el PDF de la tarjeta, revisas los movimientos y confirmas. No conectamos tu banco.',
    color: '#34d399',
    icon: <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 13h5M10 17h5" />,
  },
  {
    title: 'Operaciones',
    text: 'Cada movimiento en orden, con su billetera y su fecha.',
    color: '#ffc45c',
    icon: <path d="M5 6h14M5 12h14M5 18h9" />,
  },
];

export const ProductSection = () => {
  return (
    <section id="producto" className="mc-section">
      <div className="mc-product-head">
        <div style={{ maxWidth: 760 }}>
          <p className="mc-eyebrow">Producto</p>
          <h2 className="mc-h2">
            No son capturas.
            <br />
            Tócalo.
          </h2>
        </div>
        <p>
          Lo de abajo funciona aquí mismo, con cifras de ejemplo. Marca un pago, mueve la compra,
          abre las billeteras.
        </p>
      </div>

      <div className="mc-panel mc-demo mc-view">
        <div className="mc-demo-head">
          <div>
            <p className="mc-kicker">PANEL FINANCIERO</p>
            <h3 className="mc-h3">Las dos mitades, lado a lado</h3>
          </div>
          <p className="mc-note" style={{ margin: 0 }}>
            Toca un gasto para marcarlo como pagado.
          </p>
        </div>
        <PanelDemo />
      </div>

      <div className="mc-trio">
        <div className="mc-panel mc-feature mc-card mc-view">
          <div>
            <p className="mc-kicker">SIMULAR COMPRA</p>
            <h3 className="mc-h3">¿Me alcanza?</h3>
          </div>
          <PurchaseSimulator />
        </div>

        <div className="mc-panel mc-feature mc-card mc-view">
          <div>
            <p className="mc-kicker">PROYECCIÓN</p>
            <h3 className="mc-h3">Hasta dónde alcanza</h3>
          </div>
          <div className="mc-chart">
            <svg
              viewBox="0 0 600 220"
              role="img"
              aria-label="Gráfica de ejemplo: la liquidez sube en cada cobro, baja con los pagos y toca su punto más bajo a mitad del periodo"
            >
              <defs>
                <linearGradient id="mc-line-stroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#6f7bff" />
                  <stop offset="1" stopColor="#d65cff" />
                </linearGradient>
                <linearGradient id="mc-line-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#6f7bff" stopOpacity="0.38" />
                  <stop offset="1" stopColor="#6f7bff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 60H600M0 120H600M0 180H600"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
                fill="none"
              />
              <polygon points={`${PROJECTION_POINTS} 600,220 0,220`} fill="url(#mc-line-area)" />
              <polyline
                className="mc-line"
                points={PROJECTION_POINTS}
                fill="none"
                stroke="url(#mc-line-stroke)"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx="300" cy="176" r="6" fill="#ffc45c" />
              <circle
                cx="300"
                cy="176"
                r="13"
                fill="none"
                stroke="#ffc45c"
                strokeOpacity="0.5"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <div className="mc-chart-legend">
            <span>Hoy</span>
            <span style={{ color: '#ffc45c' }}>Punto más bajo</span>
            <span>180 días</span>
          </div>
          <p>
            Cuenta gastos recurrentes, cortes de tarjeta y cuotas de préstamos, y te dice qué día
            vas más justo.
          </p>
        </div>

        <div className="mc-panel mc-feature mc-card mc-view">
          <div>
            <p className="mc-kicker">BILLETERAS</p>
            <h3 className="mc-h3">Efectivo, débito y tarjeta</h3>
          </div>
          <div className="mc-fan">
            <div className="mc-wallet mc-f1">
              <p className="mc-wallet-name">Efectivo</p>
              <p className="mc-wallet-figure mc-num">{formatPesos(1850)}</p>
            </div>
            <div className="mc-wallet mc-f3">
              <p className="mc-wallet-name">Tarjeta de crédito</p>
              <p className="mc-wallet-figure mc-num">{formatPesos(3100)}</p>
            </div>
            <div className="mc-wallet mc-f2">
              <p className="mc-wallet-name">Débito · nómina</p>
              <p className="mc-wallet-figure mc-num">{formatPesos(12_640)}</p>
            </div>
          </div>
          <p>
            Con efectivo o débito el dinero sale ese día. Con tarjeta se suma al corte, y el pago
            cae en la quincena que le toca.
          </p>
        </div>
      </div>

      <div className="mc-tiles">
        {TILES.map((tile) => (
          <div key={tile.title} className="mc-tile mc-card mc-view">
            <svg
              viewBox="0 0 24 24"
              width="26"
              height="26"
              aria-hidden="true"
              fill="none"
              stroke={tile.color}
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {tile.icon}
            </svg>
            <h3>{tile.title}</h3>
            <p>{tile.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export const CasaSection = () => {
  return (
    <section id="casa" className="mc-section">
      <div className="mc-casa">
        <div>
          <p className="mc-eyebrow">En casa</p>
          <h2 className="mc-h2">Lo tuyo y lo de todos, sin revolverse.</h2>
          <p className="mc-lead">
            Crea una casa, invita a quien vive contigo y cambia de contexto con un toque. Cada lado
            tiene sus billeteras, sus gastos y sus quincenas.
          </p>
        </div>
        <ContextSwitch />
      </div>
    </section>
  );
};

const STEPS = [
  { title: 'Crea tu cuenta', text: 'Con tu correo. Gratis y sin tarjeta.' },
  {
    title: 'Agrega tus billeteras',
    text: 'Efectivo, débito y tarjetas de crédito, con su corte y su fecha de pago.',
  },
  {
    title: 'Planea la quincena',
    text: 'Registra el cobro y los pagos. MiCasa te dice cuánto queda libre en cada mitad.',
  },
];

export const StepsSection = () => {
  return (
    <section id="empezar" className="mc-section">
      <p className="mc-eyebrow">Cómo empiezas</p>
      <h2 className="mc-h2">Tres pasos y ya estás planeando.</h2>
      <ol className="mc-steps" style={{ listStyle: 'none', padding: 0, marginBottom: 0 }}>
        {STEPS.map((step, index) => (
          <li key={step.title} className={`mc-step mc-step-${index + 1} mc-view`}>
            <p className="mc-step-n" aria-hidden="true">
              {index + 1}
            </p>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
};

const QUESTIONS = [
  { q: '¿Cuánto cuesta?', a: 'Es gratis. No hay planes de pago.' },
  {
    q: '¿Se conecta a mi banco?',
    a: 'No, y no te pedimos tus claves. Si quieres cargar los movimientos de una tarjeta, subes el PDF del estado de cuenta, los revisas y confirmas.',
  },
  {
    q: '¿Qué cuenta como quincena?',
    a: 'La primera va del último día del mes anterior al 14. La segunda, del 15 al penúltimo día. Así cada cobro abre su propia mitad.',
  },
  {
    q: '¿Puedo llevarlo con mi pareja o mi familia?',
    a: 'Sí. Creas una casa, invitas a quien vive contigo y cada quien cambia entre lo personal y lo de la casa cuando quiera.',
  },
];

export const FaqSection = () => {
  return (
    <section id="preguntas" className="mc-section mc-faq">
      <p className="mc-eyebrow">Preguntas</p>
      <h2 className="mc-h2">Lo que la gente pregunta primero.</h2>
      {QUESTIONS.map((item, index) => (
        <details key={item.q} open={index === 0}>
          <summary>
            {item.q}
            <span className="mc-faq-plus" aria-hidden="true">
              +
            </span>
          </summary>
          <p>{item.a}</p>
        </details>
      ))}
    </section>
  );
};

export const ClosingSection = () => {
  return (
    <section id="crear" className="mc-closing">
      <div className="mc-closing-glow" aria-hidden="true" />
      <div className="mc-closing-body">
        <h2>Empieza por esta quincena.</h2>
        <p>Crea la cuenta, arma la casa o quédate en lo personal. Gratis.</p>
        <div className="mc-closing-actions">
          <Link href="/register" className="mc-cta mc-cta-glow">
            Crear cuenta
          </Link>
          <Link href="/login" className="mc-ghost">
            Iniciar sesión
          </Link>
        </div>
      </div>
    </section>
  );
};

export const LandingFooter = () => {
  return (
    <footer className="mc-footer">
      <div className="mc-footer-inner">
        <span className="mc-footer-name">MiCasa</span>
        <nav aria-label="Legal">
          <Link href="/privacy">Aviso de privacidad</Link>
          <Link href="/terms">Términos de uso</Link>
          <Link href="/login">Iniciar sesión</Link>
        </nav>
      </div>
    </footer>
  );
};
