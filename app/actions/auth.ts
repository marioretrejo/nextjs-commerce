'use server';

import { createClient } from '@/lib/supabase/server';

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { status: 'error', error: error.message };

  // Return success with the redirect target. The client calls router.refresh()
  // before router.push() so the new session cookies are visible to middleware
  // before the navigation — avoids the redirect() race condition in Server Actions.
  return { status: 'success', redirectTo };
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, company },
      emailRedirectTo: `${process.env['NEXT_PUBLIC_APP_URL'] ?? ''}/api/auth/callback`,
    },
  });

  if (error) return { status: 'error', error: error.message };

  // Email confirmation required — session is null, user must verify first.
  if (!data.session) return { status: 'needs_confirmation' };

  return { status: 'success', redirectTo: '/dashboard' };
}
