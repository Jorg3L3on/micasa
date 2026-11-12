import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Ingresos programados', {
  description: 'Ingresos que se repiten cada quincena.',
});

export default function IncomeTemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
