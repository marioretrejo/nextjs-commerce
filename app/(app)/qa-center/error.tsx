"use client";

import Link from "next/link";
import { useEffect } from "react";

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
    <div className="min-h-screen bg-[#f7f7f5] px-6 py-10">
      <div className="mx-auto max-w-xl rounded-lg border border-[#deded8] bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#77756d]">
          QA Center
        </p>
        <h1 className="mt-2 text-xl font-semibold text-[#181816]">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-[#6f6d66]">
          The QA Center view could not be loaded.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={reset}
            className="rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
          <Link
            href="/qa-center"
            className="rounded-md border border-[#d8d8d2] px-3 py-2 text-sm font-medium text-[#181816]"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
