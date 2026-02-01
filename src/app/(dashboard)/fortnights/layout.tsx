import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quincenas | MiCasa',
  description: 'Configuración de periodos quincenales.',
};

export default function FortnightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
