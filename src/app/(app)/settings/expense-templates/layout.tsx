import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Gastos programados', {
  description: 'Plantillas de gastos recurrentes y suscritos.',
});

export default function ExpenseTemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
