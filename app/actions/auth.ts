'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type AuthActionState =
  | { status: 'idle' }
  | { status: 'error'; error: string }
  | { status: 'needs_confirmation' }
  | { status: 'success'; redirectTo: string };

function sanitizeRedirect(value: string | null | undefined): string {
  if (!value) return '/dashboard';
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes(':')) return value;
  return '/dashboard';
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email') as string | null;
  const password = formData.get('password') as string | null;
  const redirectTo = sanitizeRedirect(formData.get('redirectTo') as string | null);

  if (!email || !password) return { status: 'error', error: 'Email and password are required.' };

  // Log env var presence so Render logs show exactly what's missing
  const envSnapshot = {
    NEXT_PUBLIC_SUPABASE_URL:    !!process.env['NEXT_PUBLIC_SUPABASE_URL'],
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    NEXT_PUBLIC_APP_URL:         process.env['NEXT_PUBLIC_APP_URL'] ?? '(not set)',
    NODE_ENV:                    process.env['NODE_ENV'],
  };
  console.log('[AUTH_LOGIN] attempt — env:', envSnapshot, '| email_domain:', email.split('@')[1]);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error('[AUTH_LOGIN_ERROR]', {
        message:    error.message,
        status:     error.status,
        name:       error.name,
        raw:        JSON.stringify(error),
        env:        envSnapshot,
      });
      return { status: 'error', error: error.message };
    }

    console.log('[AUTH_LOGIN] success — redirecting to:', redirectTo);
    // redirect() sends cookies + redirect in the same response, so middleware
    // always sees the session on the first request to the destination page.
    redirect(redirectTo);
  } catch (err: unknown) {
    // next/navigation redirect() throws internally — let it propagate
    if (err instanceof Error && err.message === 'NEXT_REDIRECT') throw err;
    console.error('[AUTH_LOGIN_UNEXPECTED]:', err);
    return { status: 'error', error: 'Unexpected server error — check Render logs.' };
  }
}

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = formData.get('name') as string | null;
  const email = formData.get('email') as string | null;
  const password = formData.get('password') as string | null;
  const company = (formData.get('company') as string | null) ?? '';

  if (!email || !password || !name) return { status: 'error', error: 'All fields are required.' };
  if (password.length < 8) return { status: 'error', error: 'Password must be at least 8 characters.' };

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  console.log('[AUTH_REGISTER] attempt — email_domain:', email.split('@')[1], '| emailRedirectTo:', `${appUrl}/api/auth/callback`);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, company },
        emailRedirectTo: `${appUrl}/api/auth/callback`,
      },
    });

    if (error) {
      console.error('[AUTH_REGISTER_ERROR]', { message: error.message, status: error.status, name: error.name, raw: JSON.stringify(error) });
      return { status: 'error', error: error.message };
    }

    // Email confirmation required — session is null, user must verify first.
    if (!data.session) return { status: 'needs_confirmation' };

    return { status: 'success', redirectTo: '/dashboard' };
  } catch (err: unknown) {
    console.error('[AUTH_REGISTER_UNEXPECTED]:', err);
    return { status: 'error', error: 'Unexpected server error — check Render logs.' };
  }
}
