import type { Metadata } from 'next';

import { MarketingLegalShell } from '@/components/landing/marketing-legal-shell';

export const metadata: Metadata = {
  title: 'Aviso de privacidad | MiCasa',
  description:
    'Cómo MiCasa trata datos personales de cuentas, finanzas del hogar y uso del servicio en México.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Aviso de privacidad | MiCasa',
    description:
      'Cómo MiCasa trata datos personales de cuentas, finanzas del hogar y uso del servicio en México.',
    type: 'website',
    locale: 'es_MX',
  },
};

export default function PrivacyPage() {
  return (
    <MarketingLegalShell
      title="Aviso de privacidad"
      updatedLabel="Actualizado · julio 2026"
    >
      <p>
        Este aviso describe cómo MiCasa (“nosotros”) trata datos personales cuando
        creas una cuenta, usas la aplicación o nos contactas. Está redactado para
        un lanzamiento público en México y puede actualizarse conforme el producto
        evolucione.
      </p>

      <h2>1. Responsable</h2>
      <p>
        El responsable del tratamiento es el operador de la plataforma MiCasa. Para
        ejercer derechos ARCO o consultas de privacidad, escribe al correo de
        contacto publicado en la aplicación o en el sitio.
      </p>

      <h2>2. Datos que tratamos</h2>
      <ul>
        <li>
          <strong className="text-foreground">Cuenta:</strong> nombre, correo
          electrónico y credenciales (la contraseña se almacena de forma cifrada /
          hasheada; no la guardamos en texto claro).
        </li>
        <li>
          <strong className="text-foreground">Finanzas que capturas:</strong>{' '}
          ingresos, gastos, presupuestos, billeteras, tarjetas, préstamos,
          transferencias, despensa y datos de hogar que tú registras.
        </li>
        <li>
          <strong className="text-foreground">Uso técnico:</strong> registros de
          acceso, errores de aplicación e identificadores de sesión necesarios para
          operar y proteger el servicio.
        </li>
      </ul>

      <h2>3. Finalidades</h2>
      <ul>
        <li>Prestarte el servicio de planificación financiera por quincenas.</li>
        <li>Autenticarte, mantener tu sesión y proteger la cuenta.</li>
        <li>Mejorar estabilidad, seguridad y calidad del producto.</li>
        <li>Cumplir obligaciones legales aplicables en México.</li>
      </ul>
      <p>
        No vendemos tus datos personales. No usamos tu información financiera para
        publicidad de terceros.
      </p>

      <h2>4. Conservación</h2>
      <p>
        Conservamos los datos mientras mantengas una cuenta activa y el tiempo
        adicional que exijan obligaciones legales, resolución de disputas o
        seguridad. Puedes solicitar la eliminación de tu cuenta; algunos registros
        mínimos pueden permanecer cuando la ley lo requiera.
      </p>

      <h2>5. Encargados y transferencias</h2>
      <p>
        Podemos apoyarnos en proveedores de infraestructura (por ejemplo
        hospedaje, base de datos o monitoreo) que tratan datos solo para operar
        MiCasa, bajo instrucciones y medidas de seguridad razonables. Si hay
        transferencia internacional, buscaremos salvaguardas adecuadas.
      </p>

      <h2>6. Derechos ARCO y opciones</h2>
      <p>
        Puedes solicitar acceso, rectificación, cancelación u oposición al
        tratamiento de tus datos personales, así como limitar el uso o revocar
        consentimiento cuando aplique, contactándonos por los canales del
        servicio. Te pediremos verificar tu identidad antes de responder.
      </p>

      <h2>7. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas razonables (cifrado en tránsito,
        control de acceso, hashing de contraseñas). Ningún sistema es 100&nbsp;%
        seguro; te pedimos usar una contraseña fuerte y no compartir tu sesión.
      </p>

      <h2>8. Menores</h2>
      <p>
        MiCasa no está dirigido a menores de 18 años. Si detectamos una cuenta de
        un menor sin legitimación adecuada, podremos suspenderla o eliminarla.
      </p>

      <h2>9. Cambios</h2>
      <p>
        Publicaremos la versión vigente de este aviso en{' '}
        <code className="text-foreground">/privacy</code>. El uso continuado del
        servicio después de un cambio material implica que tomaste conocimiento de
        la actualización.
      </p>
    </MarketingLegalShell>
  );
}
