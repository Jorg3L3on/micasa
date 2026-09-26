import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Nueva plantilla');

export default function NewExpenseTemplateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
