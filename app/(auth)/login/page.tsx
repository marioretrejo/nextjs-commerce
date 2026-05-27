'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction, type AuthActionState } from '@/app/actions/auth';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';

// Only allow same-origin relative paths to prevent open-redirect attacks and 404s.
function sanitizeRedirect(value: string | null): string {
  if (!value) return '/dashboard';
  if (value.startsWith('/') && !value.startsWith('//') && !value.includes(':')) {
    return value;
  }
  return '/dashboard';
}

const initialState: AuthActionState = { status: 'idle' };

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirect(
    searchParams.get('callbackUrl') ?? searchParams.get('redirect')
  );

  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (state.status === 'error') {
      toast.error(state.error);
    }
  }, [state]);

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback?next=${redirectTo}`
        }
      });
      if (error || !data?.url) {
        toast.error(error?.message ?? 'Google sign-in is not available. Please use email.');
        setGoogleLoading(false);
      }
      // On success the browser redirects to Google — no further action needed
    } catch {
      toast.error('Something went wrong. Please try again.');
      setGoogleLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-[#e0e0e0] bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Welcome back</h1>
      <p className="mb-6 text-sm text-[#6b6b6b]">Sign in to your VoiceOS account</p>

      {/* Google OAuth */}
      <Button
        type="button"
        variant="secondary"
        className="mb-4 w-full"
        onClick={handleGoogle}
        disabled={googleLoading}
      >
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </Button>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#e0e0e0]" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-[#6b6b6b]">or continue with email</span>
        </div>
      </div>

      <form action={formAction} className="space-y-4">
        {/* Passes the sanitized redirectTo to the Server Action */}
        <input type="hidden" name="redirectTo" value={redirectTo} />

        {state.status === 'error' && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-[#6b6b6b] hover:text-[#0a0a0a]">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#6b6b6b]">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-[#0a0a0a] hover:underline">
          Create account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
