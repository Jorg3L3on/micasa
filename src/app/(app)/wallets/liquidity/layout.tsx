import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Liquidez y análisis | MiCasa',
  description:
    'Entiende tu dinero: lo que ya pasó, lo que tienes hoy y lo que viene.',
};

export default function LiquidityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
