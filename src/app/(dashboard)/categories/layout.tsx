import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Categorías | MiCasa',
  description: 'Gestiona categorías para clasificar gastos.',
};

export default function CategoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
