import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

// Simulates exactly what middleware does — returns diagnostic JSON
// Remove this file before going to production.
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env['DIRECT_ACCESS_SECRET']) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  const allCookies = req.cookies.getAll();
  const cookieNames = allCookies.map(c => c.name);
  const hasSessionCookie = allCookies.some(
    ({ name }) => name.startsWith('sb-') || name.startsWith('__Secure-sb-')
  );

  let getUserResult: unknown = null;
  let getUserError: unknown = null;

  if (supabaseUrl && supabaseAnonKey) {
    try {
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll() {},
        },
      });
      const { data, error } = await supabase.auth.getUser();
      getUserResult = data.user ? { id: data.user.id, email: data.user.email } : null;
      getUserError = error?.message ?? null;
    } catch (e) {
      getUserError = String(e);
    }
  }

  return NextResponse.json({
    env: {
      supabaseUrl: supabaseUrl ?? 'MISSING',
      hasAnonKey: !!supabaseAnonKey,
    },
    cookies: {
      total: allCookies.length,
      names: cookieNames,
      hasSessionCookie,
    },
    getUser: {
      result: getUserResult,
      error: getUserError,
    },
  });
}
