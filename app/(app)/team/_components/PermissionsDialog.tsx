"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { WorkspaceMember, MemberRole } from "@/lib/supabase/types";
import { ALL_MODULES } from "@/lib/team/permissions";
import { ROLES, MODULE_LABELS } from "./constants";

export function PermissionsDialog({
  open,
  onOpenChange,
  member,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: WorkspaceMember | null;
  onSaved: () => void | Promise<void>;
}) {
  const [permModules, setPermModules] = useState<string[]>([]);
  const [permRole, setPermRole] = useState<MemberRole>("editor");
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionsError, setPermissionsError] = useState("");

  useEffect(() => {
    if (open && member) {
      setPermModules(member.visible_modules ?? [...ALL_MODULES]);
      setPermRole(member.role);
      setPermissionsError("");
    }
  }, [open, member]);

  function toggleModule(mod: string) {
    setPermModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  }

  async function savePermissions() {
    if (!member) return;
    setSavingPermissions(true);
    setPermissionsError("");
    try {
      const res = await fetch(`/api/team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: permRole, visible_modules: permModules }),
      });
      if (res.ok) {
        await onSaved();
        onOpenChange(false);
      } else {
        const err = (await res.json()) as { error?: string };
        setPermissionsError(err.error ?? "Failed to save permissions.");
      }
    } catch {
      setPermissionsError("Network error. Please try again.");
    }
    setSavingPermissions(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Module Permissions</DialogTitle>
          <DialogDescription>
            {member
              ? `Choose which modules ${member.user?.name ?? member.invite_email ?? "this member"} can access.`
              : "Choose which modules this member can access."}
          </DialogDescription>
        </DialogHeader>

        {/* Role selector */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-wider">
            Role
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => {
              const selected = permRole === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setPermRole(r.value)}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                      : "border-[#e0e0e0] hover:bg-[#f5f5f5] text-[#0a0a0a]"
                  }`}
                >
                  <p className="text-xs font-semibold">{r.label}</p>
                  <p
                    className={`text-[10px] mt-0.5 ${selected ? "text-white/70" : "text-[#9b9b9b]"}`}
                  >
                    {r.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-[#e0e0e0]" />

        {/* Module permissions */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-[#6b6b6b] uppercase tracking-wider">
            Module Access
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {ALL_MODULES.map((mod) => {
              const checked = permModules.includes(mod);
              return (
                <label
                  key={mod}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    checked
                      ? "border-[#0a0a0a] bg-[#0a0a0a]/5"
                      : "border-[#e0e0e0] hover:bg-[#f5f5f5]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleModule(mod)}
                    className="h-3.5 w-3.5 accent-[#0a0a0a]"
                  />
                  <span className="text-sm text-[#0a0a0a]">
                    {MODULE_LABELS[mod] ?? mod}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {permissionsError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {permissionsError}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={savePermissions}
            disabled={savingPermissions || !member}
          >
            {savingPermissions ? "Saving…" : "Save Permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
