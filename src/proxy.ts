import * as Sentry from '@sentry/nextjs';
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

export default Sentry.wrapMiddlewareWithSentry(proxy);

// Exclude Sentry tunnel + static brand assets; keep app routes matched so
// auth redirects still run. Public routes are listed in PUBLIC_PATHS.
export const config = {
  matcher: [
    '/((?!api|monitoring|_next/static|_next/image|favicon.ico|icon.ico|apple-touch-icon.png|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
