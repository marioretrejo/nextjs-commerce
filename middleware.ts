import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from 'lib/auth';

const TRACKER_PATHS = ['/dashboard', '/ftds', '/leads', '/alerts', '/trigger', '/top', '/history', '/settings'];
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/seed'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only apply to tracker paths
  const isTrackerPage = TRACKER_PATHS.some((p) => pathname.startsWith(p));
  const isApiRoute = pathname.startsWith('/api/') && !PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!isTrackerPage && !isApiRoute) return NextResponse.next();

  const session = await getSessionFromRequest(req);

  if (!session) {
    if (isTrackerPage) {
      return NextResponse.redirect(new URL('/login', req.url));
    }
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/ftds/:path*',
    '/leads/:path*',
    '/alerts/:path*',
    '/trigger/:path*',
    '/top/:path*',
    '/history/:path*',
    '/settings/:path*',
    '/api/((?!auth/login|seed|revalidate).*)'
  ]
};
