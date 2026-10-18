'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

/** Query flag set by the onboarding wizard when it redirects to the panel. */
export const ONBOARDING_WELCOME_PARAM = 'welcome';

/**
 * One-time hint after onboarding: shows a toast, then removes `?welcome=1`
 * so a refresh or a shared link does not repeat it.
 */
export function OnboardingWelcomeToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current) return;
    if (searchParams.get(ONBOARDING_WELCOME_PARAM) !== '1') return;
    shownRef.current = true;

    toast.success('Tu primera quincena está lista', {
      description:
        'Marca cada gasto como pagado cuando lo pagues y verás cuánto te queda libre.',
      duration: 8000,
    });

    const next = new URLSearchParams(searchParams.toString());
    next.delete(ONBOARDING_WELCOME_PARAM);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}
