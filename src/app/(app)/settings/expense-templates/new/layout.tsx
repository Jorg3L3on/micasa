import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Agregar gasto programado');

export default function NewExpenseTemplateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
