import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingLegalShell } from '@/components/landing/marketing-legal-shell';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_MAILTO,
  LEGAL_UPDATED_LABEL,
} from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Términos de uso | MiCasa',
  description:
    'Términos de uso de MiCasa: cuentas, uso aceptable, finanzas informativas, archivos subidos y responsabilidad.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Términos de uso | MiCasa',
    description:
      'Términos de uso de MiCasa: cuentas, uso aceptable, finanzas informativas, archivos subidos y responsabilidad.',
    type: 'website',
    locale: 'es_MX',
  },
};

export default function TermsPage() {
  return (
    <MarketingLegalShell
      title="Términos de uso"
      updatedLabel={LEGAL_UPDATED_LABEL}
    >
      <p>
        Estos términos regulan el acceso y uso de MiCasa. Al crear una cuenta o
        usar el servicio, aceptas estas condiciones y el{' '}
        <Link
          className="text-foreground underline underline-offset-2"
          href="/privacy"
        >
          Aviso de privacidad
        </Link>
        . Si no estás de acuerdo, no utilices la plataforma.
      </p>

      <h2>1. El servicio</h2>
      <p>
        MiCasa es una herramienta de planificación financiera personal y del
        hogar (quincenas, gastos, ingresos, billeteras, tarjetas, préstamos,
        despensa y módulos relacionados). El producto puede estar en evolución;
        funciones pueden cambiar, pausarse o retirarse con aviso razonable
        cuando sea posible.
      </p>

      <h2>2. Cuentas</h2>
      <ul>
        <li>Debes proporcionar información veraz y mantenerla actualizada.</li>
        <li>
          Eres responsable de la confidencialidad de tu contraseña y sesión.
        </li>
        <li>
          Debes tener capacidad legal para contratar en México (o la
          jurisdicción desde la que uses el servicio) y ser mayor de 18 años.
        </li>
        <li>
          Podemos suspender o cerrar cuentas que vulneren estos términos, abusen
          del servicio o pongan en riesgo a otros usuarios.
        </li>
      </ul>

      <h2>3. Uso aceptable</h2>
      <p>Te comprometes a no:</p>
      <ul>
        <li>
          Intentar acceder a datos de otros usuarios o casas sin autorización.
        </li>
        <li>
          Interferir con la seguridad, disponibilidad o integridad del servicio.
        </li>
        <li>
          Usar MiCasa para actividades ilegales o para almacenar contenido que
          vulnere derechos de terceros.
        </li>
        <li>
          Realizar ingeniería inversa abusiva, scraping masivo no autorizado o
          sobrecarga deliberada de la infraestructura.
        </li>
      </ul>

      <h2>4. Contenido financiero y decisiones</h2>
      <p>
        La información que capturas y los resúmenes que muestra MiCasa son de
        carácter informativo y de organización personal.{' '}
        <strong className="text-foreground">
          No constituyen asesoría financiera, fiscal, contable ni de inversión.
        </strong>{' '}
        Tú decides cómo actuar con base en tus datos y en profesionales
        independientes cuando lo necesites.
      </p>

      <h2>5. Archivos e importaciones</h2>
      <p>
        Si subes estados de cuenta, recibos u otros archivos, declaras que
        tienes derecho a hacerlo y que el contenido es lícito. Eres responsable
        de la exactitud de los datos importados; MiCasa puede interpretar mal o
        incompletar extracciones automáticas. Revisa siempre los resultados
        antes de tomar decisiones.
      </p>

      <h2>6. Hogares compartidos</h2>
      <p>
        Si participas en un contexto de casa/hogar, entiendes que otros
        miembros autorizados pueden ver o editar información según los roles
        del producto. Gestiona invitaciones y roles con cuidado.
      </p>

      <h2>7. Propiedad intelectual</h2>
      <p>
        MiCasa, su marca, diseño e interfaz son de sus titulares. Conservas la
        titularidad de los datos financieros y archivos que capturas; nos
        otorgas una licencia limitada para hospedarlos y procesarlos solo para
        prestar el servicio conforme al Aviso de privacidad.
      </p>

      <h2>8. Disponibilidad y garantía</h2>
      <p>
        El servicio se ofrece “tal cual” y “según disponibilidad”. No
        garantizamos disponibilidad ininterrumpida ni ausencia total de errores.
        Haremos esfuerzos razonables por mantener continuidad y corregir
        fallas materiales.
      </p>

      <h2>9. Limitación de responsabilidad</h2>
      <p>
        En la medida permitida por la ley mexicana aplicable, MiCasa no será
        responsable por daños indirectos, lucro cesante, pérdida de datos o
        decisiones financieras tomadas a partir del uso del servicio. Nuestra
        responsabilidad agregada por reclamaciones relacionadas con el servicio
        se limitará, cuando la ley lo permita, al monto que hayas pagado por
        MiCasa en los 12 meses previos (o cero si el uso fue gratuito).
      </p>

      <h2>10. Cambios</h2>
      <p>
        Podemos actualizar estos términos publicando la versión vigente en{' '}
        <code className="text-foreground">/terms</code>. Si un cambio es
        material y tienes cuenta, procuraremos un aviso razonable dentro del
        producto o por los canales disponibles.
      </p>

      <h2>11. Ley aplicable y contacto</h2>
      <p>
        Estos términos se interpretan conforme a las leyes de los Estados Unidos
        Mexicanos. Cualquier disputa se someterá a los tribunales competentes en
        México, sin perjuicio de derechos imperativos del consumidor que te
        correspondan. Para consultas sobre estos términos o el aviso de
        privacidad:{' '}
        <a
          className="text-foreground underline underline-offset-2"
          href={LEGAL_CONTACT_MAILTO}
        >
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </p>
    </MarketingLegalShell>
  );
};
