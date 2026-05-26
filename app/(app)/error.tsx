'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app-error]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-[#e0e0e0] bg-white p-8 text-center shadow-sm">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
        </div>
        <h1 className="mb-2 text-xl font-semibold">Something went wrong</h1>
        <p className="mb-6 text-sm text-[#6b6b6b]">
          An unexpected error occurred. Please try again or contact support if the problem persists.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full rounded-md bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#333]"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="w-full rounded-md border border-[#e0e0e0] px-4 py-2 text-sm font-medium text-[#6b6b6b] hover:text-[#0a0a0a]"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
