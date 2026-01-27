import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnDashboard = req.nextUrl.pathname.startsWith('/dashboard');
  const isOnRoot = req.nextUrl.pathname === '/';

  if ((isOnDashboard || isOnRoot) && !isLoggedIn) {
    return Response.redirect(new URL('/login', req.nextUrl));
  }

  if (isLoggedIn && (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/register')) {
    return Response.redirect(new URL('/dashboard', req.nextUrl));
  }

  return NextResponse.next();
});

// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
