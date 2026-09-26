import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Billeteras', {
  description: 'Gestiona billeteras y métodos de pago.',
});

export default function WalletsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
