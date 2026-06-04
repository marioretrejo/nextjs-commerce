'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction, type AuthActionState } from '@/app/actions/auth';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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

  const router = useRouter();
  const [state, formAction, isPending] = useActionState(loginAction, initialState);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (state.status === 'error') {
      toast.error(state.error);
    }
    if (state.status === 'success') {
      // router.refresh() flushes the Next.js client cache so the new session
      // cookies written by the Server Action are visible before navigation.
      router.refresh();
      router.push(state.redirectTo);
    }
  }, [state, router]);

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

      <button
        type="button"
        onClick={handleGoogle}
        disabled={googleLoading}
        className="mb-4 flex w-full items-center justify-center gap-3 rounded-md border border-[#e0e0e0] bg-white px-4 py-2.5 text-sm font-medium text-[#0a0a0a] transition hover:bg-[#f5f5f5] disabled:opacity-60"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
          <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332Z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58Z" fill="#EA4335"/>
        </svg>
        {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </button>

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
