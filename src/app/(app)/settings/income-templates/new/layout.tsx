import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Agregar ingreso programado');

export default function NewIncomeTemplateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
