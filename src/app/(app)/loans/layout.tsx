import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Préstamos', {
  description: 'Sigue préstamos, cuotas y pagos por prestamista.',
});

export default function LoansLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
