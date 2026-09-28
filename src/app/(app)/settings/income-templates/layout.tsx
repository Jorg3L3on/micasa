import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Ingresos programados', {
  description: 'Plantillas de ingresos recurrentes por quincena.',
});

export default function IncomeTemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
