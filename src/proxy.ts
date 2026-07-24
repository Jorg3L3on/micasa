import * as Sentry from '@sentry/nextjs';
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;
  const isOnDashboard = pathname.startsWith('/dashboard');
  const isOnAdmin = pathname.startsWith('/admin');
  const isOnRoot = pathname === '/';

  if ((isOnDashboard || isOnRoot || isOnAdmin) && !isLoggedIn) {
    return Response.redirect(new URL('/login', req.nextUrl));
  }

  if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
    return Response.redirect(new URL('/dashboard', req.nextUrl));
  }

  return NextResponse.next();
});

export default Sentry.wrapMiddlewareWithSentry(proxy);

// Optionally, don't invoke Proxy on some paths
export const config = {
  matcher: [
    '/((?!api|monitoring|_next/static|_next/image|favicon.ico).*)',
  ],
};
