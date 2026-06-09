"use client";

import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import type { SipTrunk, SipProtocol } from "@/lib/supabase/types";

const PROTOCOLS: SipProtocol[] = ["UDP", "TCP", "TLS", "TLS/SRTP"];

const DEFAULT_PORT: Record<SipProtocol, number> = {
  UDP: 5060,
  TCP: 5060,
  TLS: 5061,
  "TLS/SRTP": 5061,
};

interface TrunkForm {
  name: string;
  sip_host: string;
  port: string;
  username: string;
  password: string;
  netmask: string;
  protocol: SipProtocol;
}

const EMPTY_FORM: TrunkForm = {
  name: "Squaretalk",
  sip_host: "",
  port: "5060",
  username: "",
  password: "",
  netmask: "32",
  protocol: "UDP",
};

function StatusBadge({ status }: { status: SipTrunk["status"] }) {
  const map: Record<SipTrunk["status"], { label: string; className: string }> =
    {
      active: {
        label: "Active",
        className: "bg-green-50 text-green-700 border-green-200",
      },
      testing: {
        label: "Testing",
        className: "bg-blue-50 text-blue-700 border-blue-200",
      },
      error: {
        label: "Error",
        className: "bg-red-50 text-red-700 border-red-200",
      },
      disabled: {
        label: "Disabled",
        className: "bg-[#f5f5f5] text-[#6b6b6b] border-[#e8e8e8]",
      },
    };
  const s = map[status] ?? map.disabled;
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}

export default function SipTrunksPage() {
  const [trunks, setTrunks] = useState<SipTrunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TrunkForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/sip-trunks");
      if (!res.ok) throw new Error("Failed to load");
      const d = (await res.json()) as { trunks: SipTrunk[] };
      setTrunks(d.trunks ?? []);
    } catch {
      toast.error("Could not load SIP trunks");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(trunk: SipTrunk) {
    setForm({
      name: trunk.name,
      sip_host: trunk.sip_host,
      port: String(trunk.port ?? 5060),
      username: trunk.username,
      password: trunk.password,
      netmask: String(trunk.netmask ?? 32),
      protocol: trunk.protocol ?? "UDP",
    });
    setEditId(trunk.id);
    setShowForm(true);
    setShowPass(false);
  }

  function cancelForm() {
    setShowForm(false);
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowPass(false);
  }

  function setProtocol(p: SipProtocol) {
    setForm((f) => ({
      ...f,
      protocol: p,
      port: String(DEFAULT_PORT[p]),
    }));
  }

  async function save() {
    const portNum = parseInt(form.port, 10);
    const netmaskNum = parseInt(form.netmask, 10);

    if (!form.sip_host.trim()) {
      toast.error("URL is required");
      return;
    }
    if (!form.username.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!editId && !form.password.trim()) {
      toast.error("Password is required");
      return;
    }
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast.error("Port must be 1–65535");
      return;
    }
    if (isNaN(netmaskNum) || netmaskNum < 0 || netmaskNum > 32) {
      toast.error("Netmask must be 0–32");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim() || "Squaretalk",
        provider: "squaretalk",
        sip_host: form.sip_host.trim(),
        port: portNum,
        username: form.username.trim(),
        netmask: netmaskNum,
        protocol: form.protocol,
      };
      if (form.password.trim()) payload.password = form.password.trim();

      const url = editId
        ? `/api/settings/sip-trunks/${editId}`
        : "/api/settings/sip-trunks";
      const method = editId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = (await res.json()) as { error?: string };
        throw new Error(e.error ?? "Save failed");
      }
      toast.success(editId ? "SIP trunk updated" : "SIP trunk created");
      cancelForm();
      await load();
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTrunk(id: string) {
    if (!confirm("Delete this SIP trunk?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/settings/sip-trunks/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("SIP trunk deleted");
      setTrunks((ts) => ts.filter((t) => t.id !== id));
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-[#f5f5f5] rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
            SIP Trunks
          </h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Configure Squaretalk (or any SIP provider) to handle outbound calls.
          </p>
        </div>
        {!showForm && (
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
            size="sm"
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add Trunk
          </Button>
        )}
      </div>

      {/* ── Add / Edit form ── */}
      {showForm && (
        <Card className="border-[#0a0a0a]/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4" />
              {editId ? "Edit SIP Trunk" : "New SIP Trunk — Squaretalk"}
            </CardTitle>
            <CardDescription>
              Enter the connection details provided by Squaretalk (Settings →
              SIP Trunk).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
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
                  onChange={(e) =>
                    setForm((f) => ({ ...f, port: e.target.value }))
                  }
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
                      onClick={() => setProtocol(p)}
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
                onClick={save}
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
                onClick={cancelForm}
                className="gap-1.5"
              >
                <X className="h-4 w-4" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Trunk list ── */}
      {trunks.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Phone className="h-8 w-8 mx-auto text-[#c8c8c8]" />
            <p className="text-sm font-medium text-[#0a0a0a]">
              No SIP trunks configured
            </p>
            <p className="text-xs text-[#9b9b9b]">
              Add your Squaretalk SIP credentials to enable outbound calling.
            </p>
            <Button
              size="sm"
              onClick={() => setShowForm(true)}
              className="gap-1.5 mt-2"
            >
              <Plus className="h-4 w-4" /> Add Trunk
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {trunks.map((trunk) => (
            <Card key={trunk.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-[#0a0a0a]">
                        {trunk.name}
                      </span>
                      <StatusBadge status={trunk.status} />
                      <Badge
                        variant="outline"
                        className="text-xs bg-[#f5f5f5] text-[#6b6b6b] border-[#e8e8e8]"
                      >
                        {trunk.provider}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-[#6b6b6b]">
                      <span>
                        <span className="font-medium text-[#0a0a0a]">URL</span>{" "}
                        {trunk.sip_host}:{trunk.port ?? 5060}
                      </span>
                      <span>
                        <span className="font-medium text-[#0a0a0a]">
                          Protocol
                        </span>{" "}
                        {trunk.protocol ?? "UDP"}
                      </span>
                      <span>
                        <span className="font-medium text-[#0a0a0a]">
                          Username
                        </span>{" "}
                        {trunk.username}
                      </span>
                      <span>
                        <span className="font-medium text-[#0a0a0a]">
                          Netmask
                        </span>{" "}
                        /{trunk.netmask ?? 32}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => startEdit(trunk)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      disabled={deletingId === trunk.id}
                      onClick={() => deleteTrunk(trunk.id)}
                    >
                      {deletingId === trunk.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Squaretalk setup guide ── */}
      <Card className="bg-[#f9f9f9] border-[#e8e8e8]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-[#0a0a0a]">
            Where to find these values in Squaretalk
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-[#6b6b6b] space-y-1.5">
          <p>
            1. Log in to Squaretalk → <strong>Settings</strong> →{" "}
            <strong>SIP Trunk</strong>
          </p>
          <p>
            2. Copy the <strong>SIP server URL</strong> and{" "}
            <strong>port</strong> into the URL and Port fields above.
          </p>
          <p>
            3. Copy the <strong>username</strong> and <strong>password</strong>{" "}
            shown there.
          </p>
          <p>
            4. The <strong>Net mask</strong> is usually{" "}
            <code className="bg-[#f0f0f0] px-1 rounded">32</code> (single IP) —
            set a smaller value only if Squaretalk tells you to.
          </p>
          <p>
            5. <strong>Protocol</strong> is usually{" "}
            <code className="bg-[#f0f0f0] px-1 rounded">UDP</code> unless
            Squaretalk specifies otherwise.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
