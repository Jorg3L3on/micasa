import * as Sentry from '@sentry/nextjs';
import { auth } from '@/lib/auth';
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

  // Landing, auth forms, and legal pages are always public for guests.
  if (!isLoggedIn && PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (!isLoggedIn && pathname.startsWith('/dashboard')) {
    return Response.redirect(new URL('/login', req.nextUrl));
  }

  if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
    return Response.redirect(new URL('/dashboard', req.nextUrl));
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
