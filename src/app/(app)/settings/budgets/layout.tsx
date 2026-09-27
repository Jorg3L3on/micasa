import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Presupuestos', {
  description: 'Gestiona presupuestos y asignaciones por cartera.',
});

export default function BudgetsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
