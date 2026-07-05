"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Copy, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function DocSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <button
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[#fafafa] transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0f0f0] shrink-0">
          {icon}
        </span>
        <span className="flex-1 text-sm font-semibold text-[#111]">
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-[#9b9b9b] transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open && <CardContent className="pt-0 pb-5 px-5">{children}</CardContent>}
    </Card>
  );
}

export function CodeBlock({
  code,
  lang = "json",
}: {
  code: string;
  lang?: string;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    void navigator.clipboard.writeText(code).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="relative group rounded-xl bg-[#0f0f0f] border border-[#222] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#222]">
        <span className="text-[10px] font-mono text-[#555] uppercase tracking-widest">
          {lang}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[10px] text-[#555] hover:text-white transition-colors"
        >
          {copied ? (
            <CheckCircle2 className="h-3 w-3 text-green-400" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[11.5px] leading-relaxed text-[#d4d4d4] font-mono whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

export function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#111] text-[10px] font-bold text-white shrink-0">
      {n}
    </span>
  );
}
