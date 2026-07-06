"use client";

import { useState } from "react";
import { Loader2, Play, PhoneCall, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Contact } from "./types";

export function TestCallModal({
  agentId,
  variableKeys,
  onClose,
}: {
  agentId: string;
  variableKeys: string[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [varVals, setVarVals] = useState<Record<string, string>>({});
  const [calling, setCalling] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);

  function setVar(key: string, val: string) {
    setVarVals((prev) => ({ ...prev, [key]: val }));
  }

  async function start() {
    if (!phone.match(/^\+[1-9]\d{6,14}$/)) {
      toast.error("Phone must be E.164 format (+1234567890)");
      return;
    }
    setCalling(true);
    try {
      const variables: Record<string, string> = {};
      if (name) variables["contact_name"] = name;
      variableKeys.forEach((k) => {
        if (varVals[k]) variables[k] = varVals[k];
      });

      const res = await fetch("/api/calls/dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, to: phone, variables }),
      });
      const d = (await res.json()) as {
        call_id?: string;
        room_name?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(d.error ?? "Failed to initiate test call");
      } else {
        setCallId(d.call_id ?? d.room_name ?? null);
        toast.success(`Test call initiated → ${phone}`);
      }
    } catch {
      toast.error("Network error — could not start call");
    }
    setCalling(false);
  }

  const canStart = phone.trim().length > 0 && !calling;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#e0e0e0]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f5f5f5] flex items-center justify-center">
              <PhoneCall className="w-5 h-5 text-[#0a0a0a]" />
            </div>
            <p className="font-semibold text-[#0a0a0a] text-sm">
              {callId ? "Call in progress" : "Initiate a new test"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#6b6b6b] hover:text-[#0a0a0a] rounded p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {callId ? (
          /* ── Active call state ── */
          <div className="px-5 py-8 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <PhoneCall className="w-7 h-7 text-emerald-600 animate-pulse" />
            </div>
            <p className="text-sm font-medium text-[#0a0a0a]">
              Calling {phone}…
            </p>
            <p className="text-xs text-[#6b6b6b] font-mono">{callId}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 text-xs"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        ) : (
          /* ── Form ── */
          <div className="px-5 py-4 space-y-3">
            {/* Name */}
            <div className="space-y-1">
              <Label className="text-xs text-[#6b6b6b]">Name</Label>
              <Input
                placeholder="Contact name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
              />
            </div>

            {/* Phone (required) */}
            <div className="space-y-1">
              <Label className="text-xs text-[#6b6b6b]">
                International Phone Number{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="+1 809 905 2406"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
              />
            </div>

            {/* Dynamic variable fields from campaign contacts */}
            {variableKeys.map((key) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-[#6b6b6b] capitalize">
                  {key.replace(/_/g, " ")}
                </Label>
                <Input
                  placeholder={key}
                  value={varVals[key] ?? ""}
                  onChange={(e) => setVar(key, e.target.value)}
                  className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
                />
              </div>
            ))}

            <div className="pt-2">
              <Button
                className="w-full h-11 rounded-xl text-sm font-medium"
                onClick={start}
                disabled={!canStart}
              >
                {calling ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Calling…
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Add Contact Modal ──────────────────────────────────────────────────────────
