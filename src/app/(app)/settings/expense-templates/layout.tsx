import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Gastos programados', {
  description: 'Gastos que se repiten cada quincena, como renta, luz o suscripciones.',
});

export default function ExpenseTemplatesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
