import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Plantillas de presupuestos | MiCasa',
  description: 'Gestiona tus plantillas de presupuestos recurrentes.',
};

export default function BudgetTemplatesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
