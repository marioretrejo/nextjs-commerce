"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

export function DeleteAccountDialog({
  open,
  onOpenChange,
  email,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
}) {
  const [confirm1, setConfirm1] = useState("");
  const [confirm2, setConfirm2] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirm1 === "DELETE" && confirm2 === email;

  async function deleteAccount() {
    if (!canDelete) return;
    setDeleting(true);
    await fetch("/api/me", { method: "DELETE" });
    window.location.href = "/login";
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Delete Account
          </DialogTitle>
          <DialogDescription>
            This will permanently delete your account and all associated data.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="del-confirm1">
              Type <span className="font-bold font-mono">DELETE</span> to
              confirm
            </Label>
            <Input
              id="del-confirm1"
              value={confirm1}
              onChange={(e) => setConfirm1(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="del-confirm2">
              Type your email <span className="font-semibold">{email}</span> to
              confirm
            </Label>
            <Input
              id="del-confirm2"
              type="email"
              value={confirm2}
              onChange={(e) => setConfirm2(e.target.value)}
              placeholder={email}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-red-700 hover:bg-red-800 text-white border-transparent"
            disabled={!canDelete || deleting}
            onClick={deleteAccount}
          >
            {deleting ? "Deleting…" : "Delete My Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
