"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Phone } from "lucide-react";
import { toast } from "sonner";
import type { SipTrunk, SipProtocol } from "@/lib/supabase/types";
import {
  DEFAULT_PORT,
  EMPTY_FORM,
  type TrunkForm,
} from "./_components/constants";
import { TrunkFormCard } from "./_components/TrunkFormCard";
import { TrunkCard } from "./_components/TrunkCard";
import { SetupGuide } from "./_components/SetupGuide";

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
        <TrunkFormCard
          form={form}
          setForm={setForm}
          editId={editId}
          showPass={showPass}
          setShowPass={setShowPass}
          saving={saving}
          onSave={save}
          onCancel={cancelForm}
          onProtocol={setProtocol}
        />
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
            <TrunkCard
              key={trunk.id}
              trunk={trunk}
              deleting={deletingId === trunk.id}
              onEdit={startEdit}
              onDelete={deleteTrunk}
            />
          ))}
        </div>
      )}

      {/* ── Squaretalk setup guide ── */}
      <SetupGuide />
    </div>
  );
}
