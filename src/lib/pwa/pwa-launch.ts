import {
  getAppHomeHref,
  getCurrentMonthlyPanelHref,
} from '@/lib/fortnight-calendar';

const MONTHLY_PANEL_PATH = /^\/monthly\/\d{4}\/\d{2}$/;

/** Minimum time in background before a resume refetches data. */
export const PWA_RESUME_REFRESH_MS = 30 * 60 * 1000;

/** Window event fired when connectivity returns so open views refetch. */
export const PWA_CONNECTION_RESTORED_EVENT = 'micasa:connection-restored';

/** sessionStorage key: set once per app process after the launch check runs. */
export const PWA_LAUNCH_HANDLED_KEY = 'micasa.pwaLaunchHandled';

export const isStandaloneDisplay = (): boolean => {
  if (typeof window === 'undefined') return false;
  const iosStandalone =
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
    true;
  return (
    iosStandalone || window.matchMedia('(display-mode: standalone)').matches
  );
};

/**
 * Current-month Panel financiero href when `pathname` is a monthly panel for
 * another month; `null` otherwise. Preserves `search` (owner context).
 */
export const getStaleMonthlyRedirect = (
  pathname: string,
  search: string,
  now: Date = new Date(),
): string | null => {
  if (!MONTHLY_PANEL_PATH.test(pathname)) return null;
  if (pathname === getCurrentMonthlyPanelHref(now)) return null;
  return getAppHomeHref(search, now);
};

/**
 * Inline `<head>`-time script for the installed app: on a fresh launch from a
 * stale monthly URL (iOS keeps the URL the icon was added from) it replaces
 * the location before React loads, so the old month never renders.
 * `currentHref` is computed on the server at request time.
 */
export const buildLaunchRedirectScript = (currentHref: string): string => {
  const config = JSON.stringify({
    key: PWA_LAUNCH_HANDLED_KEY,
    current: currentHref,
    pattern: MONTHLY_PANEL_PATH.source,
  }).replace(/</g, '\\u003c');

  return `(function(c){try{var n=window.navigator;if(!(n.standalone===true||window.matchMedia('(display-mode: standalone)').matches))return;if(sessionStorage.getItem(c.key))return;sessionStorage.setItem(c.key,'1');var p=location.pathname;if(new RegExp(c.pattern).test(p)&&p!==c.current)location.replace(c.current+location.search)}catch(e){}})(${config})`;
};

export type ResumeAction =
  | { type: 'none' }
  | { type: 'refresh' }
  | { type: 'redirect'; href: string };

/**
 * What to do when the app becomes visible again.
 * A month rollover redirects after any time away, but only when the page
 * still shows the month that was current when it was hidden (a deliberately
 * opened past month is left alone). Data refetches after a long absence.
 */
export const getResumeAction = ({
  hiddenAt,
  hiddenCurrentHref,
  pathname,
  search,
  now,
}: {
  hiddenAt: number;
  hiddenCurrentHref: string;
  pathname: string;
  search: string;
  now: Date;
}): ResumeAction => {
  if (pathname === hiddenCurrentHref) {
    const href = getStaleMonthlyRedirect(pathname, search, now);
    if (href) return { type: 'redirect', href };
  }
  if (now.getTime() - hiddenAt < PWA_RESUME_REFRESH_MS) {
    return { type: 'none' };
  }
  return { type: 'refresh' };
};
