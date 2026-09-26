import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Editar plantilla');

export default function EditExpenseTemplateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
