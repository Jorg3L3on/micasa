import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Billetera');

export default function WalletDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
