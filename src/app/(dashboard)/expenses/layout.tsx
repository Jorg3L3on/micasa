import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gastos | MiCasa',
  description: 'Catálogo de gastos, categorías y métodos de pago.',
};

export default function ExpensesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
