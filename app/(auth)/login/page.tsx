'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction, type AuthActionState } from '@/app/actions/auth';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useActionState, useEffect } from 'react';
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

  useEffect(() => {
    if (state.status === 'error') {
      toast.error(state.error);
    }
    // On success the server action calls redirect() directly, so no client
    // navigation is needed here — the browser follows the server redirect.
  }, [state]);

  return (
    <div className="rounded-lg border border-[#e0e0e0] bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Welcome back</h1>
      <p className="mb-6 text-sm text-[#6b6b6b]">Sign in to your VoiceOS account</p>

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
