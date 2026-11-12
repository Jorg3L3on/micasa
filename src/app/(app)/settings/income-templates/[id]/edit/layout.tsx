import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Editar ingreso programado');

export default function EditIncomeTemplateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
