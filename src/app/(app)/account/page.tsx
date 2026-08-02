import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import AccountProfile from '@/components/AccountProfile';

export const metadata: Metadata = {
  title: 'Cuenta | MiCasa',
  description: 'Configura tu perfil y preferencias de cuenta.',
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { name, email, image } = session.user;

  return (
    <AccountProfile
      initialName={name ?? ''}
      email={email ?? ''}
      image={image ?? ''}
    />
  );
}
