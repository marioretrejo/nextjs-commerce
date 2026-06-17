"use client";

import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";

export default function QACenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[qa-center-error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-[#e0e0e0] bg-white p-8 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f5] border border-[#e0e0e0]">
            <ShieldAlert className="h-6 w-6 text-[#555]" />
          </div>
        </div>
        <h1 className="mb-2 text-xl font-semibold text-[#111]">
          QA Center error
        </h1>
        <p className="mb-4 text-sm text-[#6b6b6b]">
          Something went wrong loading QA Center data. Please try again.
        </p>
        {error?.message && (
          <p className="mb-4 rounded bg-[#f5f5f5] px-3 py-2 text-left font-mono text-xs text-[#0a0a0a] break-all">
            {error.message}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <button
            onClick={reset}
            className="w-full rounded-lg bg-[#111] px-4 py-2 text-sm font-medium text-white hover:bg-[#333] transition-colors"
          >
            Try again
          </button>
          <a
            href="/qa-center"
            className="w-full rounded-lg border border-[#e0e0e0] px-4 py-2 text-sm font-medium text-[#6b6b6b] hover:text-[#111] hover:border-[#111] transition-colors"
          >
            Go to QA Center
          </a>
        </div>
      </div>
    </div>
  );
}
