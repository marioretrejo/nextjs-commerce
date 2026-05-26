import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const Schema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  next: z.string().optional(),
});

// Called by the browser login form after a successful signInWithPassword.
// Sets session cookies server-side so the middleware can read them on the
// next navigation — bypassing the document.cookie read-back limitation.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { access_token, refresh_token, next = '/dashboard' } = parsed.data;

  const cookiesToSet: { name: string; value: string; options?: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() { return []; },
        setAll(cookies) { cookiesToSet.push(...cookies); },
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
