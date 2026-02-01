import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Plantillas de gastos | MiCasa',
  description: 'Plantillas de gastos recurrentes y suscritos.',
};

export default function ExpenseTemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
