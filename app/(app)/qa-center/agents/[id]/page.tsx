"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Phone,
  MessageSquare,
  BarChart2,
  XCircle,
  Loader2,
  Edit2,
  Save,
  X,
} from "lucide-react";
import type { AgentProfile, Tab } from "./_components/types";
import { OverviewTab } from "./_components/OverviewTab";
import { CallsTab } from "./_components/CallsTab";
import { CoachingTab } from "./_components/CoachingTab";
import { PerformanceTab } from "./_components/PerformanceTab";

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [agentDbId, setAgentDbId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFields, setEditFields] = useState({
    name: "",
    email: "",
    team: "",
    role: "",
    hire_date: "",
  });

  // Resolve params
  useEffect(() => {
    params.then(({ id }) => setAgentDbId(id));
  }, [params]);

  const fetchProfile = useCallback(async () => {
    if (!agentDbId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/qac/agents/${agentDbId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? "Failed to load agent",
        );
      }
      const data: AgentProfile = await res.json();
      setProfile(data);
      setEditFields({
        name: data.name ?? "",
        email: data.email ?? "",
        team: data.team ?? "",
        role: data.role ?? "",
        hire_date: data.hire_date ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [agentDbId]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  async function saveEdits() {
    if (!agentDbId || !profile) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/qac/agents/${agentDbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editFields.name || undefined,
          email: editFields.email || undefined,
          team: editFields.team || undefined,
          role: editFields.role || undefined,
          hire_date: editFields.hire_date || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Failed to save");
      }
      await fetchProfile();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!agentDbId || !profile) return;
    if (
      !confirm(
        `Deactivate ${profile.name}? They will no longer appear in active agent lists.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/qac/agents/${agentDbId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to deactivate");
      router.push("/qa-center/agents");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deactivate failed");
    }
  }

  /* ── Skeleton ── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-gray-400">
        <XCircle className="h-10 w-10 text-red-500/50" />
        <p className="text-sm">{error}</p>
        <button
          onClick={() => router.push("/qa-center/agents")}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          ← Back to Agents
        </button>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.push("/qa-center/agents")}
              className="mt-0.5 flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-gray-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-300">
                  {profile.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold text-white">
                      {profile.name}
                    </h1>
                    {!profile.is_active && (
                      <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">
                    {profile.role ?? "Agent"}
                    {profile.team ? ` · ${profile.team}` : ""}
                    {profile.email ? ` · ${profile.email}` : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  onClick={() => void saveEdits()}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit
                </button>
                {profile.is_active && (
                  <button
                    onClick={() => void deactivate()}
                    className="flex items-center gap-1.5 rounded-lg border border-red-800/50 bg-red-900/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/30"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Deactivate
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Inline edit form */}
        {editing && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(
              [
                { field: "name", label: "Name" },
                { field: "email", label: "Email" },
                { field: "team", label: "Team" },
                { field: "role", label: "Role" },
                { field: "hire_date", label: "Hire Date", type: "date" },
              ] as Array<{
                field: keyof typeof editFields;
                label: string;
                type?: string;
              }>
            ).map(({ field, label, type }) => (
              <div key={field}>
                <label className="mb-1 block text-xs text-gray-500">
                  {label}
                </label>
                <input
                  type={type ?? "text"}
                  value={editFields[field]}
                  onChange={(e) =>
                    setEditFields((prev) => ({
                      ...prev,
                      [field]: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          {(
            [
              { id: "overview", label: "Overview", icon: User },
              { id: "calls", label: "Calls", icon: Phone },
              { id: "coaching", label: "Coaching", icon: MessageSquare },
              { id: "performance", label: "Performance", icon: BarChart2 },
            ] as Array<{
              id: Tab;
              label: string;
              icon: React.FC<{ className?: string }>;
            }>
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                tab === id
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {tab === "overview" && <OverviewTab profile={profile} />}
        {tab === "calls" && (
          <CallsTab calls={profile.recent_calls} router={router} />
        )}
        {tab === "coaching" && (
          <CoachingTab reports={profile.coaching_reports} />
        )}
        {tab === "performance" && <PerformanceTab profile={profile} />}
      </div>
    </div>
  );
}
