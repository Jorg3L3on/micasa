import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Agregar plantilla de gastos');

export default function NewExpenseTemplateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
