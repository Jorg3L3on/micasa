import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { LandingPage } from '@/components/landing/landing-page';
import { auth } from '@/lib/auth';
import { getAppHomeHref } from '@/lib/fortnight-calendar';
import prisma from '@/lib/prisma';

const SITE_TITLE = 'MiCasa | Planea tu dinero por quincenas';
const SITE_DESCRIPTION =
  'Gestión financiera para México: organiza ingresos, gastos, billeteras y operaciones por quincenas. Personal o casa compartida.';

export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
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

const QUICK_CAPTURE_VALUES = new Set(['expense', 'income']);

/**
 * Same redirect as before (onboarding, then the current panel). It sits in its
 * own Suspense so a guest does not wait on auth behind the root splash.
 * The proxy already sends a signed-in `/` to the panel before HTML streams.
 */
async function RedirectSignedInUser({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string | string[] }>;
}) {
  const session = await auth();

  if (!session?.user?.id) return null;

  const userId = Number(session.user.id);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboarding_completed: true },
  });

  if (!user?.onboarding_completed) {
    redirect('/onboarding');
  }

  const { quick } = await searchParams;
  const query = new URLSearchParams();
  if (typeof quick === 'string' && QUICK_CAPTURE_VALUES.has(quick)) {
    query.set('quick', quick);
  }
  redirect(getAppHomeHref(query));
}

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ quick?: string | string[] }>;
}) {
  return (
    <>
      <Suspense fallback={null}>
        <RedirectSignedInUser searchParams={searchParams} />
      </Suspense>
      <LandingPage />
    </>
  );
}
