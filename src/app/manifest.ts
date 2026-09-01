import type { MetadataRoute } from 'next';

/** Orion navy canvas — `DESIGN.md` / `.dark --background`. */
const ORION_NAVY = '#060914';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MiCasa',
    short_name: 'MiCasa',
    description:
      'Gestión financiera y planificación por quincenas. Controla ingresos, gastos y transacciones.',
    lang: 'es-MX',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: ORION_NAVY,
    theme_color: ORION_NAVY,
    categories: ['finance'],
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
