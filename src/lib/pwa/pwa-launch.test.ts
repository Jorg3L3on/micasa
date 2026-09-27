import { describe, expect, it, vi } from 'vitest';
import {
  buildLaunchRedirectScript,
  getResumeAction,
  getStaleMonthlyRedirect,
  PWA_LAUNCH_HANDLED_KEY,
  PWA_RESUME_REFRESH_MS,
} from '@/lib/pwa/pwa-launch';

const mxNoon = (ymd: string) => new Date(`${ymd}T18:00:00.000Z`);

const runLaunchScript = ({
  pathname,
  search = '',
  standalone = true,
  handled = false,
}: {
  pathname: string;
  search?: string;
  standalone?: boolean;
  handled?: boolean;
}) => {
  const storage = new Map<string, string>(
    handled ? [[PWA_LAUNCH_HANDLED_KEY, '1']] : [],
  );
  const replace = vi.fn();
  const window = {
    navigator: { standalone },
    matchMedia: () => ({ matches: false }),
  };
  const sessionStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  };
  const location = { pathname, search, replace };
  new Function('window', 'sessionStorage', 'location', buildLaunchRedirectScript('/monthly/2026/09'))(
    window,
    sessionStorage,
    location,
  );
  return { replace, storage };
};

describe('buildLaunchRedirectScript', () => {
  it('replaces a stale monthly URL on a fresh standalone launch', () => {
    const { replace, storage } = runLaunchScript({
      pathname: '/monthly/2026/08',
      search: '?ownerType=house&ownerId=3',
    });
    expect(replace).toHaveBeenCalledWith(
      '/monthly/2026/09?ownerType=house&ownerId=3',
    );
    expect(storage.get(PWA_LAUNCH_HANDLED_KEY)).toBe('1');
  });

  it('only runs once per app process', () => {
    const { replace } = runLaunchScript({
      pathname: '/monthly/2026/08',
      handled: true,
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it('does nothing in a regular browser tab', () => {
    const { replace, storage } = runLaunchScript({
      pathname: '/monthly/2026/08',
      standalone: false,
    });
    expect(replace).not.toHaveBeenCalled();
    expect(storage.size).toBe(0);
  });

  it('leaves the current month and other pages alone', () => {
    expect(runLaunchScript({ pathname: '/monthly/2026/09' }).replace).not.toHaveBeenCalled();
    expect(runLaunchScript({ pathname: '/wallets' }).replace).not.toHaveBeenCalled();
  });
});

describe('getStaleMonthlyRedirect', () => {
  it('redirects a past monthly panel to the current month', () => {
    expect(
      getStaleMonthlyRedirect('/monthly/2026/08', '', mxNoon('2026-09-26')),
    ).toBe('/monthly/2026/09');
  });

  it('keeps the current month', () => {
    expect(
      getStaleMonthlyRedirect('/monthly/2026/09', '', mxNoon('2026-09-26')),
    ).toBeNull();
  });

  it('treats the last civil day as next month FIRST', () => {
    expect(
      getStaleMonthlyRedirect('/monthly/2026/09', '', mxNoon('2026-09-30')),
    ).toBe('/monthly/2026/10');
  });

  it('preserves owner query params', () => {
    expect(
      getStaleMonthlyRedirect(
        '/monthly/2026/08',
        '?ownerType=house&ownerId=3',
        mxNoon('2026-09-26'),
      ),
    ).toBe('/monthly/2026/09?ownerType=house&ownerId=3');
  });

  it('ignores non-monthly paths', () => {
    expect(
      getStaleMonthlyRedirect('/wallets', '', mxNoon('2026-09-26')),
    ).toBeNull();
    expect(
      getStaleMonthlyRedirect(
        '/fortnight/2026/08/FIRST',
        '',
        mxNoon('2026-09-26'),
      ),
    ).toBeNull();
  });
});

describe('getResumeAction', () => {
  const now = mxNoon('2026-10-02');

  it('does nothing after a short background in the same month', () => {
    expect(
      getResumeAction({
        hiddenAt: now.getTime() - 60_000,
        hiddenCurrentHref: '/monthly/2026/10',
        pathname: '/monthly/2026/10',
        search: '',
        now,
      }),
    ).toEqual({ type: 'none' });
  });

  it('redirects on a rollover even after a short background', () => {
    const lastDay = mxNoon('2026-09-30');
    expect(
      getResumeAction({
        hiddenAt: lastDay.getTime() - 60_000,
        hiddenCurrentHref: '/monthly/2026/09',
        pathname: '/monthly/2026/09',
        search: '?ownerType=user&ownerId=1',
        now: lastDay,
      }),
    ).toEqual({
      type: 'redirect',
      href: '/monthly/2026/10?ownerType=user&ownerId=1',
    });
  });

  it('redirects when the month rolled over while hidden', () => {
    expect(
      getResumeAction({
        hiddenAt: now.getTime() - PWA_RESUME_REFRESH_MS,
        hiddenCurrentHref: '/monthly/2026/09',
        pathname: '/monthly/2026/09',
        search: '',
        now,
      }),
    ).toEqual({ type: 'redirect', href: '/monthly/2026/10' });
  });

  it('refreshes a deliberately opened past month instead of redirecting', () => {
    expect(
      getResumeAction({
        hiddenAt: now.getTime() - PWA_RESUME_REFRESH_MS,
        hiddenCurrentHref: '/monthly/2026/09',
        pathname: '/monthly/2026/07',
        search: '',
        now,
      }),
    ).toEqual({ type: 'refresh' });
  });

  it('refreshes non-monthly pages after a long background', () => {
    expect(
      getResumeAction({
        hiddenAt: now.getTime() - PWA_RESUME_REFRESH_MS * 2,
        hiddenCurrentHref: '/monthly/2026/09',
        pathname: '/wallets',
        search: '',
        now,
      }),
    ).toEqual({ type: 'refresh' });
  });
});
