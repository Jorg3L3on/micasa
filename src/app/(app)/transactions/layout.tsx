import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Transacciones | MiCasa',
  description: 'Historial de transacciones y operaciones.',
};

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
