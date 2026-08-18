import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Plantillas de ingresos | MiCasa',
  description: 'Plantillas de ingresos recurrentes por quincena.',
};

export default function IncomeTemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
