import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export default async function Home() {
  const session = await auth();

  // Not logged in → always go to login
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = Number(session.user.id);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboarding_completed: true },
  });

  // Logged in but onboarding not completed → go to onboarding
  if (!user?.onboarding_completed) {
    redirect('/onboarding');
  }

  // Logged in and onboarding completed → go to dashboard
  redirect('/dashboard');
}

