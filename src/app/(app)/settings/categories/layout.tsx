import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Categorías', {
  description: 'Gestiona categorías para clasificar gastos.',
});

export default function CategoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
