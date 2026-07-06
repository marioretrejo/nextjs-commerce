"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";

export function CodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative rounded-xl bg-[#0a0a0a] border border-[#1f1f1f]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1f1f1f]">
        <span className="text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
          {language}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-[#6b6b6b] hover:text-white transition-colors"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm font-mono text-[#e0e0e0] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export function MethodBadge({ method }: { method: HttpMethod }) {
  const colors: Record<HttpMethod, string> = {
    GET: "bg-blue-100 text-blue-700",
    POST: "bg-green-100 text-green-700",
    PATCH: "bg-amber-100 text-amber-700",
    DELETE: "bg-red-100 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono ${colors[method]}`}
    >
      {method}
    </span>
  );
}

export interface EndpointCardProps {
  method: HttpMethod;
  path: string;
  summary: string;
  description: string;
  children: React.ReactNode;
}

export function EndpointCard({
  method,
  path,
  summary,
  description,
  children,
}: EndpointCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-[#e0e0e0] rounded-xl overflow-hidden">
      <button
        className="flex w-full items-center gap-3 px-5 py-4 bg-white hover:bg-[#fafafa] transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <MethodBadge method={method} />
        <code className="text-sm font-mono text-[#0a0a0a] flex-1">{path}</code>
        <span className="text-sm text-[#6b6b6b] hidden sm:block">
          {summary}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-[#6b6b6b] shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#6b6b6b] shrink-0" />
        )}
      </button>
      {open && (
        <div className="border-t border-[#e0e0e0] bg-[#fafafa] p-5 space-y-4">
          <p className="text-sm text-[#6b6b6b] leading-relaxed">
            {description}
          </p>
          {children}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ code }: { code: number | string }) {
  const n = Number(code);
  const cls =
    n < 300
      ? "bg-green-100 text-green-700"
      : n < 500
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-mono ${cls}`}
    >
      {code}
    </span>
  );
}

// ─── Download helpers ─────────────────────────────────────────────────────────
