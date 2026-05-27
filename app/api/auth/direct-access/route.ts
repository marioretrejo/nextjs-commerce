import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// One-shot dashboard access endpoint — bypasses the login form entirely.
// Protected by DIRECT_ACCESS_SECRET env var; returns 403 if not configured.
// Usage: GET /api/auth/direct-access?secret=YOUR_SECRET&email=x&password=y
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const email = searchParams.get('email');
  const password = searchParams.get('password');
  const next = searchParams.get('next') ?? '/dashboard';

  const expectedSecret = process.env['DIRECT_ACCESS_SECRET'];
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!email || !password) {
    return NextResponse.json({ error: 'email and password required' }, { status: 400 });
  }

  const cookiesToSet: { name: string; value: string; options?: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() { return []; },
        setAll(cookies: { name: string; value: string; options?: CookieOptions }[]) { cookiesToSet.push(...cookies); },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return NextResponse.json({ error: error?.message ?? 'Login failed' }, { status: 401 });
  }

  const redirectUrl = new URL(next, request.url).toString();
  const response = NextResponse.redirect(redirectUrl);

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });

  return response;
}
