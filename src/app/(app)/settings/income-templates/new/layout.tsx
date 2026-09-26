import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Nueva plantilla');

export default function NewIncomeTemplateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
