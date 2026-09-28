import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Operaciones', {
  description: 'Historial de movimientos.',
});

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
