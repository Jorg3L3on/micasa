import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MiCasa',
    short_name: 'MiCasa',
    description:
      'Gestión financiera y planificación por quincenas. Controla ingresos, gastos y transacciones.',
    start_url: '/',
    display: 'standalone',
    background_color: '#060914',
    theme_color: '#060914',
    lang: 'es-MX',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
