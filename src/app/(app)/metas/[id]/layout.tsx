import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Meta');

export default function MetaDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
