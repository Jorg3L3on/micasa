import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Editar gasto programado');

export default function EditExpenseTemplateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
