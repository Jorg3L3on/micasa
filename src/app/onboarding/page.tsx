import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  return <OnboardingWizard />;
}
