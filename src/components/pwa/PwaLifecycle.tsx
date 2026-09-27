'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMonthlyPanelRefresh } from '@/components/monthly/monthly-panel-refresh';
import { getCurrentMonthlyPanelHref } from '@/lib/fortnight-calendar';
import {
  getResumeAction,
  isStandaloneDisplay,
  PWA_CONNECTION_RESTORED_EVENT,
} from '@/lib/pwa/pwa-launch';

/**
 * Installed-app resume: follows a month rollover and refetches stale data.
 * Cold-launch redirects run earlier, in `buildLaunchRedirectScript`.
 */
export function PwaLifecycle() {
  const router = useRouter();
  const pathname = usePathname();
  const refreshPanel = useMonthlyPanelRefresh();
  const pathnameRef = useRef(pathname);
  const hiddenRef = useRef<{ at: number; currentHref: string } | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const refreshCurrentView = useCallback(async () => {
    if (!pathnameRef.current.startsWith('/monthly/')) {
      router.refresh();
      return;
    }
    try {
      await refreshPanel();
    } catch (error) {
      console.error('Error refreshing panel on resume:', error);
    }
  }, [refreshPanel, router]);

  useEffect(() => {
    if (!isStandaloneDisplay()) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenRef.current = {
          at: Date.now(),
          currentHref: getCurrentMonthlyPanelHref(),
        };
        return;
      }

      const hidden = hiddenRef.current;
      hiddenRef.current = null;
      if (!hidden) return;

      const action = getResumeAction({
        hiddenAt: hidden.at,
        hiddenCurrentHref: hidden.currentHref,
        pathname: window.location.pathname,
        search: window.location.search,
        now: new Date(),
      });
      if (action.type === 'redirect') {
        router.replace(action.href);
        return;
      }
      if (action.type === 'refresh') void refreshCurrentView();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshCurrentView, router]);

  useEffect(() => {
    const handleConnectionRestored = () => void refreshCurrentView();
    window.addEventListener(
      PWA_CONNECTION_RESTORED_EVENT,
      handleConnectionRestored,
    );
    return () =>
      window.removeEventListener(
        PWA_CONNECTION_RESTORED_EVENT,
        handleConnectionRestored,
      );
  }, [refreshCurrentView]);

  return null;
}
