import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, X, Eye, EyeOff, Phone } from "lucide-react";
import type { SipProtocol } from "@/lib/supabase/types";
import { PROTOCOLS, type TrunkForm } from "./constants";

export function TrunkFormCard({
  form,
  setForm,
  editId,
  showPass,
  setShowPass,
  saving,
  onSave,
  onCancel,
  onProtocol,
}: {
  form: TrunkForm;
  setForm: Dispatch<SetStateAction<TrunkForm>>;
  editId: string | null;
  showPass: boolean;
  setShowPass: Dispatch<SetStateAction<boolean>>;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onProtocol: (p: SipProtocol) => void;
}) {
  return (
    <Card className="border-[#0a0a0a]/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Phone className="h-4 w-4" />
          {editId ? "Edit SIP Trunk" : "New SIP Trunk — Squaretalk"}
        </CardTitle>
        <CardDescription>
          Enter the connection details provided by Squaretalk (Settings → SIP
          Trunk).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label>Label</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Squaretalk Production"
          />
        </div>

        {/* URL + Port on the same row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>
              URL <span className="text-red-500">*</span>
            </Label>
            <Input
              value={form.sip_host}
              onChange={(e) =>
                setForm((f) => ({ ...f, sip_host: e.target.value }))
              }
              placeholder="sip.squaretalk.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Port <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              value={form.port}
              onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
              placeholder="5060"
              min={1}
              max={65535}
            />
          </div>
        </div>

        {/* Username */}
        <div className="space-y-1.5">
          <Label>
            Username <span className="text-red-500">*</span>
          </Label>
          <Input
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({ ...f, username: e.target.value }))
            }
            placeholder="SIP username from Squaretalk"
            autoComplete="off"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label>
            Password {!editId && <span className="text-red-500">*</span>}
          </Label>
          <div className="relative">
            <Input
              type={showPass ? "text" : "password"}
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              placeholder={
                editId
                  ? "Leave blank to keep current"
                  : "SIP password from Squaretalk"
              }
              autoComplete="new-password"
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPass((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b] hover:text-[#0a0a0a]"
            >
              {showPass ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Netmask + Protocol on same row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Net Mask (0–32)</Label>
            <Input
              type="number"
              value={form.netmask}
              onChange={(e) =>
                setForm((f) => ({ ...f, netmask: e.target.value }))
              }
              placeholder="32"
              min={0}
              max={32}
            />
            <p className="text-xs text-[#9b9b9b]">
              Squaretalk calls this "Net mask address pattern"
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Protocol</Label>
            <div className="flex gap-1.5 flex-wrap">
              {PROTOCOLS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onProtocol(p)}
                  className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                    form.protocol === p
                      ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                      : "bg-white text-[#0a0a0a] border-[#e8e8e8] hover:border-[#0a0a0a]"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            onClick={onSave}
            disabled={saving}
            size="sm"
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {editId ? "Save Changes" : "Create Trunk"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="gap-1.5"
          >
            <X className="h-4 w-4" /> Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
