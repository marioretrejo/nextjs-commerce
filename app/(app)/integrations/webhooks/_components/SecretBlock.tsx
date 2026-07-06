"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, Copy } from "lucide-react";

export function SecretBlock({
  secret,
  onDone,
}: {
  secret: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
        <div className="text-sm text-red-700">
          <p className="font-bold">Copy this secret now.</p>
          <p className="text-xs mt-0.5">
            For security, it will not be shown again. Store it in your password
            manager or environment variables.
          </p>
        </div>
      </div>
      <div className="relative rounded-lg border border-[#e0e0e0] bg-[#f8f8f8] p-3 font-mono text-xs text-[#0a0a0a] break-all pr-10">
        {secret}
        <button
          onClick={copy}
          className="absolute right-2 top-2 rounded p-1 hover:bg-[#e8e8e8] transition-colors"
          title="Copy secret"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 text-[#6b6b6b]" />
          )}
        </button>
      </div>
      <p className="text-xs text-[#6b6b6b]">
        Use this secret to verify the{" "}
        <code className="bg-[#f0f0f0] px-1 rounded">X-VoiceOS-Signature</code>{" "}
        header on incoming webhook requests. Format:{" "}
        <code className="bg-[#f0f0f0] px-1 rounded">
          t=&#123;ts&#125;,v1=&#123;hmac-sha256&#125;
        </code>
      </p>
      <Button size="sm" onClick={onDone} className="w-full">
        I've saved the secret
      </Button>
    </div>
  );
}
