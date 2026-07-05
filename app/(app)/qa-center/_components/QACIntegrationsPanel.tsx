"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type QACIntegrationConfig,
  DEFAULT_FIELD_MAPPINGS,
  PROVIDER_PRESETS,
} from "./integrations-config";
import { WebhookUrlCard } from "./WebhookUrlCard";
import { FieldMappingCard } from "./FieldMappingCard";
import { PlatformGuidesCard } from "./PlatformGuidesCard";

// ─── Integrations Panel ───────────────────────────────────────────────────────

export function QACIntegrationsPanel() {
  const [config, setConfig] = useState<QACIntegrationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  // Field mapping editor state — keyed by VoiceOS field, value is comma-separated candidates
  const [mappingDraft, setMappingDraft] = useState<Record<string, string>>({});
  const [savingMappings, setSavingMappings] = useState(false);
  const [showMappings, setShowMappings] = useState(false);
  const [providerName, setProviderName] = useState("");
  const [testPayload, setTestPayload] = useState("");
  const [testResult, setTestResult] = useState<Record<
    string,
    string | null
  > | null>(null);

  useEffect(() => {
    fetch("/api/qac/integrations")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: QACIntegrationConfig) => {
        setConfig(d);
        setAccountSid(d.twilio_account_sid ?? "");
        setProviderName(d.provider_name ?? "");
        // Initialise mapping draft from saved config (merge with defaults)
        const merged = {
          ...DEFAULT_FIELD_MAPPINGS,
          ...(d.field_mappings ?? {}),
        };
        const draft: Record<string, string> = {};
        for (const [k, v] of Object.entries(merged))
          draft[k] = (v as string[]).join(", ");
        setMappingDraft(draft);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const webhookUrl = config
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/qac/webhooks/${config.webhook_token}`
    : "";

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/qac/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          twilio_account_sid: accountSid.trim() || null,
          twilio_auth_token: authToken.trim() || null,
          auto_analyze: config?.auto_analyze ?? true,
          agent_name_field: config?.agent_name_field ?? "To",
          provider_name: providerName.trim() || null,
        }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      const updated = (await res.json()) as QACIntegrationConfig;
      setConfig(updated);
      setAuthToken("");
      toast.success("Integration settings saved");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function saveMappings() {
    setSavingMappings(true);
    try {
      // Convert draft strings back to arrays
      const mappings: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(mappingDraft)) {
        mappings[k] = v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
      const res = await fetch("/api/qac/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field_mappings: mappings }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      const updated = (await res.json()) as QACIntegrationConfig;
      setConfig(updated);
      toast.success("Field mappings saved");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSavingMappings(false);
    }
  }

  function loadPreset(provider: string) {
    const preset = PROVIDER_PRESETS[provider];
    if (!preset) return;
    const merged = { ...DEFAULT_FIELD_MAPPINGS, ...preset };
    const draft: Record<string, string> = {};
    for (const [k, v] of Object.entries(merged))
      draft[k] = (v as string[]).join(", ");
    setMappingDraft(draft);
    setProviderName(provider);
    toast.success(
      `${provider.charAt(0).toUpperCase() + provider.slice(1)} preset loaded — click Save Mappings to apply`,
    );
  }

  function runTestExtraction() {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(testPayload) as Record<string, unknown>;
    } catch {
      toast.error("Invalid JSON in test payload");
      return;
    }

    const result: Record<string, string | null> = {};
    for (const field of Object.keys(DEFAULT_FIELD_MAPPINGS)) {
      const candidates = mappingDraft[field]
        ? mappingDraft[field]!.split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : (DEFAULT_FIELD_MAPPINGS[field] ?? []);
      let found: string | null = null;
      for (const key of candidates) {
        const val = payload[key];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          found = String(val).trim();
          break;
        }
      }
      result[field] = found;
    }
    setTestResult(result);
  }

  function copyUrl() {
    void navigator.clipboard.writeText(webhookUrl);
    toast.success("Webhook URL copied");
  }

  if (loading)
    return <div className="h-64 bg-[#f5f5f5] rounded-xl animate-pulse" />;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-[#111]">Integrations</h3>
        <p className="text-xs text-[#6b6b6b] mt-0.5">
          Connect your call center platform to automatically ingest recordings
          and trigger QA analysis.
        </p>
      </div>

      <WebhookUrlCard webhookUrl={webhookUrl} copyUrl={copyUrl} />

      {/* Twilio credentials */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Twilio Credentials</CardTitle>
          <CardDescription>
            Required to download protected recordings. Leave blank if your
            recordings are publicly accessible.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Account SID</Label>
              <Input
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Auth Token{" "}
                {config?.twilio_account_sid && (
                  <span className="text-green-600 font-normal text-[10px] ml-1">
                    ● saved
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  type={showToken ? "text" : "password"}
                  placeholder={
                    config?.twilio_account_sid
                      ? "••••••••••• (leave blank to keep existing)"
                      : "Your Twilio Auth Token"
                  }
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="font-mono text-xs pr-16"
                />
                <button
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#9b9b9b] font-medium"
                  onClick={() => setShowToken((s) => !s)}
                >
                  {showToken ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Switch
              checked={config?.auto_analyze ?? true}
              onCheckedChange={(v) =>
                setConfig((c) => (c ? { ...c, auto_analyze: v } : c))
              }
            />
            <div>
              <Label>Auto-analyze recordings</Label>
              <p className="text-xs text-[#9b9b9b] mt-0.5">
                QA analysis starts immediately when a recording arrives
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Agent Name Source{" "}
                <span className="text-[#9b9b9b] font-normal">
                  (Twilio legacy)
                </span>
              </Label>
              <Select
                value={config?.agent_name_field ?? "To"}
                onValueChange={(v) =>
                  setConfig((c) => (c ? { ...c, agent_name_field: v } : c))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="To">
                    To number (destination — agent's line)
                  </SelectItem>
                  <SelectItem value="From">From number (caller)</SelectItem>
                  <SelectItem value="CallSid">Call SID</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-[#9b9b9b]">
                Fallback when field_mappings has no agent_name match
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Provider Name</Label>
              <Input
                placeholder="e.g. Squaretalk, Voiso, Twilio…"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                className="text-xs"
              />
              <p className="text-xs text-[#9b9b9b]">
                Label shown in interaction metadata for traceability
              </p>
            </div>
          </div>

          <Button onClick={save} disabled={saving} size="sm" className="gap-2">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      <FieldMappingCard
        showMappings={showMappings}
        setShowMappings={setShowMappings}
        loadPreset={loadPreset}
        mappingDraft={mappingDraft}
        setMappingDraft={setMappingDraft}
        saveMappings={saveMappings}
        savingMappings={savingMappings}
        testPayload={testPayload}
        setTestPayload={setTestPayload}
        runTestExtraction={runTestExtraction}
        testResult={testResult}
      />

      <PlatformGuidesCard />
    </div>
  );
}
