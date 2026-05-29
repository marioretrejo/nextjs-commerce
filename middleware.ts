import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { checkRateLimit, recordRejection } from '@/lib/ratelimit';

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
  '/api/webhooks/livekit',
  '/api/webhooks/twilio',
  '/api/webhooks/stripe',
  '/api/health',
  '/api/debug',
  '/api/auth/callback',
  '/api/auth/set-session',
  '/api/auth/signout',
  '/api/auth/direct-access',
];

const ADMIN_PATHS = ['/admin'];

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function buildLoginRedirect(req: NextRequest, pathname: string, reason?: string): NextResponse {
  const loginUrl = new URL('/login', req.url);
  loginUrl.searchParams.set('callbackUrl', pathname);
  const res = NextResponse.redirect(loginUrl);
  if (reason) res.headers.set('x-debug-auth-reason', reason);
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow all public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return NextResponse.next();
  }

  // API key authentication + rate limiting for programmatic access (Bearer vos_xxx)
  const authHeader = req.headers.get('authorization');
  if (pathname.startsWith('/api/') && authHeader?.startsWith('Bearer vos_')) {
    const rawKey = authHeader.slice(7);
    const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

    if (supabaseUrl && serviceKey) {
      const keyHash = await sha256Hex(rawKey);
      const res = await fetch(
        `${supabaseUrl}/rest/v1/api_keys?key_hash=eq.${keyHash}&is_active=eq.true&select=id,workspace_id,workspace:workspaces(api_rate_limit_rps,billing_status)`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
      );
      if (res.ok) {
        const rows = await res.json() as { id: string; workspace_id: string; workspace?: { api_rate_limit_rps?: number | null; billing_status?: string } }[];
        if (rows.length > 0) {
          const workspaceId = rows[0]!.workspace_id;
          const customRps = rows[0]!.workspace?.api_rate_limit_rps ?? undefined;

          // ── Rate limiting (only for /api/v1/* routes) ────────────────
          let rlResult: Awaited<ReturnType<typeof checkRateLimit>> | null = null;
          if (pathname.startsWith('/api/v1/')) {
            rlResult = await checkRateLimit(`ws:${workspaceId}`, customRps ?? undefined);
            if (!rlResult.allowed) {
              void recordRejection(workspaceId);
              return NextResponse.json(
                { error: 'Rate limit exceeded. See Retry-After header.', code: 'RATE_LIMIT' },
                {
                  status: 429,
                  headers: {
                    'X-RateLimit-Limit':     String(rlResult.limit),
                    'X-RateLimit-Remaining': '0',
                    'X-RateLimit-Reset':     String(rlResult.reset),
                    'Retry-After':           String(rlResult.retryAfter ?? 1),
                  },
                }
              );
            }
          }

          // Update last_used_at fire-and-forget
          fetch(`${supabaseUrl}/rest/v1/api_keys?id=eq.${rows[0]!.id}`, {
            method: 'PATCH',
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({ last_used_at: new Date().toISOString() }),
          }).catch(() => {});

          // Block API access for workspaces suspended for non-payment
          const wsBillingStatus = rows[0]!.workspace?.billing_status;
          if (wsBillingStatus === 'suspended_for_nonpayment') {
            return NextResponse.json(
              { error: 'Workspace suspended for non-payment. Contact support.', code: 'WORKSPACE_SUSPENDED' },
              { status: 403 }
            );
          }

          const response = NextResponse.next({ request: req });
          response.headers.set('x-api-workspace-id', workspaceId);
          // Attach rate limit headers to allowed responses
          if (rlResult) {
            response.headers.set('X-RateLimit-Limit',     String(rlResult.limit));
            response.headers.set('X-RateLimit-Remaining', String(rlResult.remaining));
            response.headers.set('X-RateLimit-Reset',     String(rlResult.reset));
          }
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

  // Fast pre-check: skip the Supabase getUser() round-trip when no session
  // cookies exist at all. Broad match (any sb-* cookie) avoids false negatives
  // caused by chunked JWTs where only sb-{ref}-auth-token.0 exists, not the
  // base cookie name. The actual getUser() call below is the authoritative check.
  const allCookies = req.cookies.getAll();
  const hasSessionCookie = allCookies.some(
    ({ name }) => name.startsWith('sb-') || name.startsWith('__Secure-sb-')
  );

  if (!hasSessionCookie) {
    return buildLoginRedirect(req, pathname, `no-session-cookie|cookies:${allCookies.map(c=>c.name).join(',')}`);
  }

  // Official Next.js 15 + Supabase SSR pattern — passes the request object so
  // Server Components see any cookies that the middleware refreshes during
  // token validation.
  let supabaseResponse = NextResponse.next({ request: req });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
        );
      },
    },
  });

  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (!user) {
    return buildLoginRedirect(req, pathname, `getUser-null|error:${getUserError?.message ?? 'none'}|cookies:${allCookies.map(c=>c.name).join(',')}`);
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

  // ── Impersonation cookie ────────────────────────────────────────────────
  // When a superadmin clicks "Login as client", the browser receives a
  // vos-impersonation=<token> cookie. We validate it here and attach
  // x-impersonation-workspace-id so the app layout renders the correct workspace.
  const impToken = req.cookies.get('vos-impersonation')?.value;
  if (impToken && supabaseUrl && process.env['SUPABASE_SERVICE_ROLE_KEY']) {
    const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    try {
      const impRes = await fetch(
        `${supabaseUrl}/rest/v1/impersonation_sessions?token=eq.${impToken}&ended_at=is.null&select=id,target_workspace_id,expires_at`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      );
      if (impRes.ok) {
        const rows = await impRes.json() as { id: string; target_workspace_id: string; expires_at: string }[];
        if (rows.length > 0 && new Date(rows[0]!.expires_at) > new Date()) {
          supabaseResponse.headers.set('x-impersonation-workspace-id', rows[0]!.target_workspace_id);
        }
      }
    } catch { /* non-fatal — impersonation simply won't activate */ }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
