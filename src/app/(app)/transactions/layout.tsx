import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Transacciones', {
  description: 'Historial de transacciones y operaciones.',
});

export default function TransactionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
