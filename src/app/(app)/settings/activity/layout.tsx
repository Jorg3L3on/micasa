import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Actividad', {
  description: 'Quién cambió qué en tu casa o tu cuenta, y los inicios de sesión.',
});

export default function ActivityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
