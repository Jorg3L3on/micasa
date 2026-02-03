import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Carteras | MiCasa',
  description: 'Gestiona carteras y métodos de pago.',
};

export default function WalletsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
