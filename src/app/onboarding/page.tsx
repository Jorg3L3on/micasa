import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import CreateWallet from '@/components/onboarding/CreateWallet';

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = Number(session.user.id);
  const wallet = await prisma.wallet.findFirst({
    where: {
      user_id: userId,
      house_id: null,
    },
  });

  if (wallet) {
    redirect('/dashboard');
  }

  return <CreateWallet />;
}
