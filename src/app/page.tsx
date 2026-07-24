import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { LandingPage } from '@/components/landing/landing-page';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const SITE_TITLE = 'MiCasa — Planifica tu dinero por quincenas';
const SITE_DESCRIPTION =
  'Gestión financiera para México: organiza ingresos, gastos, billeteras y obligaciones por quincenas. Personal o casa compartida.';

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: 'website',
    locale: 'es_MX',
    siteName: 'MiCasa',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default async function Home() {
  const session = await auth();

  if (session?.user?.id) {
    const userId = Number(session.user.id);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboarding_completed: true },
    });

    if (!user?.onboarding_completed) {
      redirect('/onboarding');
    }

    redirect('/dashboard');
  }

  return <LandingPage />;
}
