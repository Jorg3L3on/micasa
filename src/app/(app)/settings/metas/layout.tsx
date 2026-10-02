import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Metas', {
  description: 'Metas de ahorro y aportes.',
});

export default function MetasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
