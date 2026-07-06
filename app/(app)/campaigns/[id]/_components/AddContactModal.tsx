"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Contact } from "./types";

export function AddContactModal({
  campaignId,
  variableKeys,
  onClose,
  onAdded,
}: {
  campaignId: string;
  variableKeys: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [varVals, setVarVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  function setVar(key: string, val: string) {
    setVarVals((prev) => ({ ...prev, [key]: val }));
  }

  async function save() {
    if (!phone.trim()) {
      toast.error("Phone is required");
      return;
    }
    setSaving(true);
    const variables: Record<string, string> = {};
    variableKeys.forEach((k) => {
      if (varVals[k]) variables[k] = varVals[k];
    });

    const res = await fetch(`/api/campaigns/${campaignId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contacts: [
          {
            name: name || null,
            phone: phone.trim(),
            email: email || null,
            status: "pending",
            attempts: 0,
            variables: Object.keys(variables).length > 0 ? variables : null,
          },
        ],
      }),
    });
    if (!res.ok) {
      toast.error("Failed to add contact");
    } else {
      toast.success("Contact added");
      onAdded();
      onClose();
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm shadow-2xl mx-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#e0e0e0]">
          <p className="font-semibold text-[#0a0a0a] text-sm">Add Contact</p>
          <button
            onClick={onClose}
            className="text-[#6b6b6b] hover:text-[#0a0a0a] rounded p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-[#6b6b6b]">Name</Label>
            <Input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#6b6b6b]">
              Phone <span className="text-red-500">*</span>
            </Label>
            <Input
              placeholder="+1 809 905 2406"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-[#6b6b6b]">Email</Label>
            <Input
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 text-sm rounded-xl border-[#e0e0e0] bg-[#f9f9f9]"
            />
          </div>
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
              className="w-full h-11 rounded-xl text-sm"
              onClick={save}
              disabled={saving || !phone.trim()}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Add Contact
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
