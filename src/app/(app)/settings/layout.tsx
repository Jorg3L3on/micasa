import type { Metadata } from 'next';
import { SettingsShell } from '@/components/settings/SettingsShell';

export const metadata: Metadata = {
  title: 'Configuración | MiCasa',
  description: 'Catálogos, automatizaciones y cuenta.',
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SettingsShell>{children}</SettingsShell>;
}
