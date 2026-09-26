import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Estado de cuenta', {
  description: 'Estados de cuenta y movimientos de tarjetas.',
});

export default function CreditCardsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
