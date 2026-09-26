import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Usuarios de la casa', {
  description: 'Miembros y roles de la casa.',
});

export default function HouseUsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
