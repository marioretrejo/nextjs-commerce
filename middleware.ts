import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/verify-email',
  '/onboarding',
  '/suspended',
  '/invite',
  '/widget',
  '/api/webhooks/retell',
  '/api/webhooks/stripe',
  '/api/webhooks/elevenlabs',
  '/api/health',
  '/api/debug',
  '/api/auth/set-session',
];

const ADMIN_PATHS = ['/admin'];

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow all public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Allow static files and next internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // API key authentication for programmatic access (Bearer vos_xxx)
  const authHeader = req.headers.get('authorization');
  if (pathname.startsWith('/api/') && authHeader?.startsWith('Bearer vos_')) {
    const rawKey = authHeader.slice(7); // strip "Bearer "
    const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (supabaseUrl && serviceKey) {
      const keyHash = await sha256Hex(rawKey);
      const res = await fetch(
        `${supabaseUrl}/rest/v1/api_keys?key_hash=eq.${keyHash}&status=eq.active&select=id,workspace_id`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      if (res.ok) {
        const rows = await res.json() as { id: string; workspace_id: string }[];
        if (rows.length > 0) {
          // Update last_used_at asynchronously (fire-and-forget)
          fetch(`${supabaseUrl}/rest/v1/api_keys?id=eq.${rows[0]!.id}`, {
            method: 'PATCH',
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ last_used_at: new Date().toISOString() }),
          }).catch(() => {});
          const response = NextResponse.next({ request: req });
          response.headers.set('x-api-workspace-id', rows[0]!.workspace_id);
          return response;
        }
      }
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
  }

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  // If Supabase is not configured, allow all requests (development mode)
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  // Official Next.js 15 + Supabase SSR pattern — passes request so Server Components
  // see any cookies that the middleware refreshes during token validation.
  let supabaseResponse = NextResponse.next({ request: req });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        // Propagate refreshed cookies to both the forwarded request and the response
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
        );
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Superadmin check for /admin routes
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_superadmin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_superadmin) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
};
