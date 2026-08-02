import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Presupuestos | MiCasa',
  description: 'Gestiona presupuestos y asignaciones por cartera.',
};

export default function BudgetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
