import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const Schema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  next: z.string().optional(),
});

// Called by the browser login/register form after a successful signInWithPassword
// or signUp. Sets session cookies server-side (via HTTP Set-Cookie headers) so the
// Next.js Edge middleware can read them on the very next navigation — bypassing the
// document.cookie write-then-read limitation.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { access_token, refresh_token, next = '/dashboard' } = parsed.data;

  const cookiesToSet: { name: string; value: string; options?: CookieOptions }[] = [];

  // In production (HTTPS) set the Secure flag so cookies are only transmitted
  // over encrypted connections. httpOnly stays false because the browser-side
  // Supabase client also needs to read these cookies.
  const isProduction = process.env['NODE_ENV'] === 'production';

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() { return []; },
        setAll(cookies: { name: string; value: string; options?: CookieOptions }[]) { cookiesToSet.push(...cookies); },
      },
      cookieOptions: {
        secure: isProduction,
        sameSite: 'lax',
        httpOnly: false,
        path: '/',
      },
    }
  );

  const { data: { session }, error } = await supabase.auth.setSession({ access_token, refresh_token });

  if (error || !session) {
    return NextResponse.json({ error: error?.message ?? 'Failed to set session' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, next });
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });
  return response;
}
