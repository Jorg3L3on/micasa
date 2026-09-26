import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Liquidez y análisis', {
  description:
    'Entiende tu dinero: lo que ya pasó, lo que tienes hoy y lo que viene.',
});

export default function LiquidityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
