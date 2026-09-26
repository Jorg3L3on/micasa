import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { getAppHomeHref } from '@/lib/fortnight-calendar';
import prisma from '@/lib/prisma';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export const metadata: Metadata = {
  title: 'Primeros pasos',
};

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = Number(session.user.id);
  if (!Number.isNaN(userId)) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboarding_completed: true },
    });

    if (user?.onboarding_completed) {
      redirect(getAppHomeHref());
    }
  }

  return <OnboardingWizard />;
}
