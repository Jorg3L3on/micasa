import { SettingsShell } from '@/components/settings/SettingsShell';
import { documentTitle } from '@/lib/document-title';

export const metadata = documentTitle('Configuración', {
  description: 'Catálogos, automatizaciones y cuenta.',
});

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SettingsShell>{children}</SettingsShell>;
}
