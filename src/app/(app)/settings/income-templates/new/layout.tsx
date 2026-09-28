import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Agregar plantilla de ingresos');

export default function NewIncomeTemplateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
