import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const AUTH_COOKIE_NAME = 'barba_larga_auth';

export function middleware(request: NextRequest) {
  // Only redirect standard GET page navigations; let Server Actions (POST) handle auth gracefully
  if (request.method !== 'GET') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Protect admin sub-routes: ONLY 'admin' role can access these financial/team/log pages
  if (
    pathname.startsWith('/admin/cash-flow') ||
    pathname.startsWith('/admin/team') ||
    pathname.startsWith('/admin/notifications') ||
    pathname.startsWith('/admin/system-logs')
  ) {
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    try {
      const [base64Data] = token.split('.');
      if (!base64Data) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      // Decode base64url safely in edge runtime
      const base64 = base64Data.replace(/-/g, '+').replace(/_/g, '/');
      const jsonStr = atob(base64);
      const data = JSON.parse(jsonStr);

      if (data.exp < Date.now() || data.role !== 'admin') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/cash-flow/:path*',
    '/admin/team/:path*',
    '/admin/notifications/:path*',
    '/admin/system-logs/:path*',
  ],
};
