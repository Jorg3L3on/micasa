import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketingLegalShell } from '@/components/landing/marketing-legal-shell';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_CONTACT_MAILTO,
  LEGAL_UPDATED_LABEL,
} from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Aviso de privacidad | MiCasa',
  description:
    'Aviso de privacidad de MiCasa conforme a la LFPDPPP: datos tratados, finalidades, conservación, transferencias y derechos ARCO.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Aviso de privacidad | MiCasa',
    description:
      'Aviso de privacidad de MiCasa conforme a la LFPDPPP: datos tratados, finalidades, conservación, transferencias y derechos ARCO.',
    type: 'website',
    locale: 'es_MX',
  },
};

export default function PrivacyPage() {
  return (
    <MarketingLegalShell
      title="Aviso de privacidad"
      updatedLabel={LEGAL_UPDATED_LABEL}
    >
      <p>
        Este Aviso de Privacidad describe el tratamiento de datos personales por
        MiCasa (“nosotros”, “el Responsable”), de conformidad con la Ley Federal
        de Protección de Datos Personales en Posesión de los Particulares
        (LFPDPPP), su Reglamento y lineamientos aplicables en México. Aplica
        cuando creas una cuenta, usas la aplicación o nos contactas.
      </p>

      <h2>1. Identidad y contacto del Responsable</h2>
      <p>
        El Responsable del tratamiento es el operador de la plataforma MiCasa.
        Para ejercer derechos ARCO, limitar el uso o divulgación de tus datos,
        revocar consentimiento cuando aplique, o plantear dudas de privacidad,
        escribe a{' '}
        <a
          className="text-foreground underline underline-offset-2"
          href={LEGAL_CONTACT_MAILTO}
        >
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </p>

      <h2>2. Datos personales que tratamos</h2>
      <p>Según el uso que hagas del servicio, podemos tratar:</p>
      <ul>
        <li>
          <strong className="text-foreground">Cuenta e identidad:</strong> nombre,
          correo electrónico y credenciales. La contraseña se almacena de forma
          hasheada; no la guardamos en texto claro.
        </li>
        <li>
          <strong className="text-foreground">Finanzas que capturas:</strong>{' '}
          ingresos, gastos, presupuestos, quincenas, billeteras, tarjetas de
          crédito o departamentales, pagos, préstamos, transferencias, categorías
          y datos de hogar/casa que tú o miembros autorizados registran.
        </li>
        <li>
          <strong className="text-foreground">Archivos que subes:</strong>{' '}
          estados de cuenta (por ejemplo PDF/CSV de emisores soportados) y
          recibos de despensa (imágenes o documentos), junto con el texto o
          líneas que el sistema extrae de esos archivos para prestarte el
          servicio.
        </li>
        <li>
          <strong className="text-foreground">Contexto de hogar:</strong> si
          participas en una casa compartida, tu membresía y rol, y la
          información financiera visible según esos roles.
        </li>
        <li>
          <strong className="text-foreground">Datos técnicos y de sesión:</strong>{' '}
          cookies o tokens de sesión necesarios para autenticarte (sesión JWT),
          registros de acceso, mensajes de error de aplicación e identificadores
          técnicos (por ejemplo id de usuario u owner en monitoreo) para operar
          y proteger el servicio.
        </li>
      </ul>
      <p>
        No solicitamos de forma deliberada datos personales sensibles en el
        sentido de la LFPDPPP (por ejemplo origen racial o étnico, estado de
        salud, creencias religiosas, etc.). Te pedimos no subir ese tipo de
        información en notas o archivos.
      </p>

      <h2>3. Finalidades del tratamiento</h2>
      <p>
        <strong className="text-foreground">Finalidades primarias</strong>{' '}
        (necesarias para el servicio):
      </p>
      <ul>
        <li>Crear y administrar tu cuenta, autenticarte y mantener tu sesión.</li>
        <li>
          Prestarte la planificación financiera por quincenas y los módulos
          relacionados (gastos, ingresos, billeteras, tarjetas, préstamos,
          despensa, etc.).
        </li>
        <li>
          Procesar importaciones de estados de cuenta y recibos que tú subes.
        </li>
        <li>
          Permitir la colaboración en hogares compartidos según roles
          configurados.
        </li>
        <li>
          Prevenir fraude, abuso y accesos no autorizados; cumplir obligaciones
          legales aplicables en México.
        </li>
      </ul>
      <p>
        <strong className="text-foreground">Finalidades secundarias</strong>{' '}
        (mejora del producto): analizar errores y estabilidad (por ejemplo
        monitoreo de excepciones) para mejorar calidad y seguridad. No vendemos
        tus datos personales ni usamos tu información financiera para
        publicidad de terceros.
      </p>
      <p>
        Si en el futuro introdujéramos finalidades secundarias distintas que
        requieran consentimiento, te lo comunicaremos y podrás oponerte por los
        medios de este aviso.
      </p>

      <h2>4. Conservación</h2>
      <p>
        Conservamos los datos mientras mantengas una cuenta activa y el tiempo
        adicional razonable para seguridad, resolución de disputas u
        obligaciones legales. Si solicitas la cancelación o eliminación de tu
        cuenta, borraremos o anonimizaremos los datos personales asociados en
        la medida técnica y legal posible; pueden permanecer registros mínimos
        cuando la ley lo exija (por ejemplo trazas de seguridad).
      </p>

      <h2>5. Encargados y transferencias</h2>
      <p>
        Para operar MiCasa podemos apoyarnos en proveedores que tratan datos
        como encargados, solo bajo instrucciones y con medidas de seguridad
        razonables, por ejemplo:
      </p>
      <ul>
        <li>
          Infraestructura de hospedaje y entrega de la aplicación (p. ej.
          Vercel).
        </li>
        <li>
          Base de datos PostgreSQL en la nube (p. ej. Neon u otro proveedor
          equivalente según el entorno).
        </li>
        <li>
          Monitoreo de errores (p. ej. Sentry), con contexto técnico limitado
          (ids de usuario/owner; sin contraseñas ni títulos con datos
          financieros libres).
        </li>
      </ul>
      <p>
        Algunos proveedores pueden estar ubicados fuera de México. En esos
        casos buscaremos salvaguardas adecuadas conforme a la normativa
        aplicable. No realizamos transferencias a terceros para fines
        comerciales ajenos al servicio.
      </p>

      <h2>6. Cookies y sesión</h2>
      <p>
        Usamos cookies o almacenamiento equivalente estrictamente necesarios
        para autenticación y seguridad de la sesión (por ejemplo tokens de
        NextAuth / Auth.js). No utilizamos cookies de publicidad de terceros.
      </p>

      <h2>7. Derechos ARCO y opciones</h2>
      <p>
        En los términos de la LFPDPPP, puedes solicitar{' '}
        <strong className="text-foreground">
          Acceso, Rectificación, Cancelación u Oposición
        </strong>{' '}
        (derechos ARCO), así como limitar el uso o divulgación de tus datos y,
        cuando aplique, revocar el consentimiento otorgado para finalidades
        secundarias.
      </p>
      <ul>
        <li>
          Medio: correo a{' '}
          <a
            className="text-foreground underline underline-offset-2"
            href={LEGAL_CONTACT_MAILTO}
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          , indicando el derecho que deseas ejercer y datos suficientes para
          localizar tu cuenta (p. ej. el correo registrado).
        </li>
        <li>
          Verificación: te pediremos acreditar tu identidad antes de responder,
          para evitar entregas indebidas de información.
        </li>
        <li>
          Plazo: atenderemos las solicitudes en los plazos previstos por la
          normativa aplicable, o te informaremos si necesitamos información
          adicional.
        </li>
      </ul>
      <p>
        También puedes actualizar ciertos datos de cuenta desde la propia
        aplicación cuando esa función esté disponible.
      </p>

      <h2>8. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas razonables: cifrado en
        tránsito (HTTPS), control de acceso por cuenta, hashing de contraseñas y
        aislamiento de datos por usuario/casa. Ningún sistema es 100&nbsp;%
        seguro; usa una contraseña fuerte y no compartas tu sesión.
      </p>

      <h2>9. Menores de edad</h2>
      <p>
        MiCasa no está dirigido a menores de 18 años. Si detectamos una cuenta
        de un menor sin legitimación adecuada, podremos suspenderla o
        eliminarla.
      </p>

      <h2>10. Cambios a este aviso</h2>
      <p>
        Publicaremos la versión vigente en{' '}
        <code className="text-foreground">/privacy</code>. Si un cambio es
        material, procuraremos un aviso razonable en el producto o por los
        canales disponibles. El uso continuado del servicio después de la
        publicación implica que tomaste conocimiento de la actualización.
      </p>

      <h2>11. Relación con los términos</h2>
      <p>
        El uso de MiCasa también se rige por los{' '}
        <Link
          className="text-foreground underline underline-offset-2"
          href="/terms"
        >
          Términos de uso
        </Link>
        .
      </p>
    </MarketingLegalShell>
  );
};
