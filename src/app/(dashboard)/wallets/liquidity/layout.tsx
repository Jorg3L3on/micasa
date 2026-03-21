import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Proyección de liquidez | MiCasa',
  description:
    'Efectivo y débito vs pagos a estado de tarjetas en un horizonte de fechas.',
};

export default function LiquidityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
