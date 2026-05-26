import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription ?? error)}`
    );
  }

  if (code) {
    const cookiesToSet: { name: string; value: string; options?: CookieOptions }[] = [];

    const supabase = createServerClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(toSet) {
            cookiesToSet.push(...toSet);
          }
        }
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env['NODE_ENV'] === 'development';

      let redirectUrl: string;
      if (isLocalEnv) {
        redirectUrl = `${origin}${next}`;
      } else if (forwardedHost) {
        redirectUrl = `https://${forwardedHost}${next}`;
      } else {
        redirectUrl = `${origin}${next}`;
      }

      const response = NextResponse.redirect(redirectUrl);

      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
      });

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
