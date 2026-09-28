import { auth } from '@/lib/auth';
import { getAppHomeHref, getCurrentMonthlyPanelHref } from '@/lib/fortnight-calendar';
import { NextResponse } from 'next/server';

/** Routes that must stay reachable without a session (landing + auth + legal). */
const PUBLIC_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/privacy',
  '/terms',
  '/offline',
]);

const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // OAuth DCR at issuer root: GET /register stays the signup page; POST/OPTIONS → DCR handler.
  if (
    pathname === '/register' &&
    (req.method === 'POST' || req.method === 'OPTIONS')
  ) {
    return NextResponse.rewrite(new URL('/api/oauth/register', req.url));
  }

  // Landing, auth forms, and legal pages are always public for guests.
  if (!isLoggedIn && PUBLIC_PATHS.has(pathname)) {
    if (pathname === '/') {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set('x-micasa-pathname', pathname);
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    return NextResponse.next();
  }

  if (
    !isLoggedIn &&
    (pathname.startsWith('/dashboard') ||
      pathname.startsWith('/monthly') ||
      pathname.startsWith('/admin'))
  ) {
    return Response.redirect(new URL('/login', req.nextUrl));
  }

  if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
    return Response.redirect(
      new URL(getCurrentMonthlyPanelHref(), req.nextUrl),
    );
  }

  // PWA start_url: redirect before any HTML streams so the launch loader
  // renders once (a redirect from the page would reload it mid-animation).
  // The (app) layout still sends unfinished onboarding to /onboarding.
  if (isLoggedIn && pathname === '/') {
    const query = new URLSearchParams();
    const quick = req.nextUrl.searchParams.get('quick');
    if (quick === 'expense' || quick === 'income') {
      query.set('quick', quick);
    }
    return Response.redirect(new URL(getAppHomeHref(query), req.nextUrl));
  }

  // Legacy Inicio bookmarks → Panel financiero (preserve owner query).
  if (
    isLoggedIn &&
    (pathname === '/dashboard' || pathname.startsWith('/dashboard/'))
  ) {
    const query = new URLSearchParams();
    const ownerType = req.nextUrl.searchParams.get('ownerType');
    const ownerId = req.nextUrl.searchParams.get('ownerId');
    if (ownerType && ownerId) {
      query.set('ownerType', ownerType);
      query.set('ownerId', ownerId);
    }
    return Response.redirect(new URL(getAppHomeHref(query), req.nextUrl));
  }

  return NextResponse.next();
});

export default proxy;

// Exclude static brand assets; keep app routes matched so auth redirects still run.
// Public routes are listed in PUBLIC_PATHS.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|icon.ico|icon|apple-touch-icon.png|apple-icon|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
