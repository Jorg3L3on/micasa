import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Plantillas de gastos', {
  description: 'Plantillas de gastos recurrentes y suscritos.',
});

export default function ExpenseTemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
