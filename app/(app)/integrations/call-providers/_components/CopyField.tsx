"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

// Read-only labeled value with a copy button. Used for the webhook URL + secret.
export function CopyField({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-[#6b6b6b]">{label}</p>
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 truncate rounded-md border border-[#e0e0e0] bg-[#f5f5f5] px-3 py-2 text-xs text-[#0a0a0a] ${
            mono ? "font-mono" : ""
          }`}
        >
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#e0e0e0] bg-white px-3 py-2 text-xs font-medium text-[#0a0a0a] transition-colors hover:bg-[#f5f5f5]"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
