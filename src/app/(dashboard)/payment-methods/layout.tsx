import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Métodos de pago | MiCasa',
  description: 'Gestiona métodos de pago y tarjetas.',
};

export default function PaymentMethodsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
