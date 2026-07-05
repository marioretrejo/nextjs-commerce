"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Copy, Globe, Loader2, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Integrations Panel ───────────────────────────────────────────────────────

interface QACIntegrationConfig {
  id: string;
  webhook_token: string;
  twilio_account_sid: string | null;
  auto_analyze: boolean;
  agent_name_field: string;
  is_active: boolean;
  provider_name: string | null;
  field_mappings: Record<string, string[]> | null;
}

const DEFAULT_FIELD_MAPPINGS: Record<string, string[]> = {
  recording_url: [
    "RecordingUrl",
    "recording_url",
    "audioUrl",
    "audio_url",
    "recordingUrl",
    "file_url",
  ],
  agent_name: [
    "agent_name",
    "To",
    "user_name",
    "extension",
    "sip_user",
    "called_number",
  ],
  customer_phone: [
    "From",
    "caller_id",
    "customer_phone",
    "ani",
    "calling_number",
  ],
  call_id: [
    "CallSid",
    "call_id",
    "callId",
    "session_id",
    "external_call_id",
    "call_uuid",
  ],
  duration: [
    "RecordingDuration",
    "duration",
    "call_duration",
    "callDuration",
    "duration_seconds",
  ],
  transcript: ["transcript", "transcription", "text", "call_transcript"],
  agent_id: ["agent_id", "user_id", "extension_id", "sip_user_id"],
  direction: ["direction", "call_direction", "callDirection", "call_type"],
  outcome: ["outcome", "call_outcome", "disposition", "hangup_cause"],
  language: ["language", "lang", "transcript_lang"],
  customer_name: ["customer_name", "contact_name", "callerName"],
};

const PROVIDER_PRESETS: Record<string, Record<string, string[]>> = {
  twilio: {
    recording_url: ["RecordingUrl"],
    agent_name: ["To"],
    customer_phone: ["From"],
    call_id: ["CallSid"],
    duration: ["RecordingDuration"],
  },
  squaretalk: {
    recording_url: ["recording_url", "audio_url", "file_url"],
    agent_name: ["agent_name", "user_name", "extension"],
    customer_phone: ["caller_id", "from_number", "ani"],
    call_id: ["call_id", "call_uuid", "session_id"],
    duration: ["duration", "call_duration"],
    direction: ["direction", "call_type"],
    outcome: ["outcome", "disposition"],
  },
  voiso: {
    recording_url: ["recording_url", "audioUrl", "recordingUrl"],
    agent_name: ["agent", "agent_name", "operator"],
    customer_phone: ["customer_phone", "caller", "from"],
    call_id: ["call_id", "callId"],
    duration: ["duration", "billsec"],
    direction: ["direction"],
    outcome: ["disposition", "outcome"],
  },
  genesys: {
    recording_url: ["mediaUrl", "recording_url"],
    agent_name: ["participantName", "agentName", "agent_name"],
    customer_phone: ["ani", "caller_id", "from"],
    call_id: ["conversationId", "call_id"],
    duration: ["duration", "talkTime"],
    direction: ["direction"],
    outcome: ["wrapUpCode", "disposition"],
  },
};

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

      {/* Webhook URL card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-[#111] flex items-center justify-center">
              <Globe className="h-3.5 w-3.5 text-white" />
            </div>
            Webhook URL
          </CardTitle>
          <CardDescription>
            Configure this URL as the Recording Status Callback in your Twilio
            number or campaign settings. When a call recording is ready, Twilio
            will POST to this endpoint and QA analysis starts automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-[#f5f5f5] border border-[#e8e8e8] px-3 py-2.5 text-xs font-mono text-[#111] break-all">
              {webhookUrl}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={copyUrl}
              className="shrink-0 gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </Button>
          </div>
          <div className="flex gap-2 rounded-xl bg-[#f8f8f8] border border-[#efefef] p-3">
            <div className="space-y-1 text-xs text-[#6b6b6b]">
              <p className="font-semibold text-[#555]">
                How to configure in Twilio:
              </p>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>Go to Twilio Console → Phone Numbers → Active Numbers</li>
                <li>Select the number your agents use</li>
                <li>
                  Under <strong>Voice &amp; Fax</strong> →{" "}
                  <strong>Call Status Changes</strong>, paste this URL
                </li>
                <li>
                  Enable <strong>Record Calls</strong> in your TwiML or number
                  settings
                </li>
              </ol>
              <p className="pt-1">
                Alternatively, set{" "}
                <code className="bg-[#f0f0f0] px-1 rounded">
                  RecordingStatusCallback
                </code>{" "}
                in your TwiML &lt;Record&gt; verb.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* Field Mapping Engine */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Field Mapping Engine</CardTitle>
              <CardDescription className="mt-0.5">
                Map your SIP provider's payload keys to VoiceOS fields. Each row
                is an ordered list of candidates — the first non-empty match
                wins. Works with Twilio, Squaretalk, Voiso, Genesys, and any
                custom SIP trunk.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMappings((s) => !s)}
              className="shrink-0 gap-1.5"
            >
              {showMappings ? (
                <>
                  <X className="h-3.5 w-3.5" />
                  Close
                </>
              ) : (
                "Configure Mappings"
              )}
            </Button>
          </div>
        </CardHeader>

        {showMappings && (
          <CardContent className="space-y-4">
            {/* Provider presets */}
            <div>
              <p className="text-[10px] font-semibold text-[#9b9b9b] uppercase tracking-widest mb-2">
                Load Preset
              </p>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(PROVIDER_PRESETS).map((p) => (
                  <button
                    key={p}
                    onClick={() => loadPreset(p)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#e0e0e0] bg-white hover:bg-[#f5f5f5] hover:border-[#111] transition-colors capitalize"
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const draft: Record<string, string> = {};
                    for (const [k, v] of Object.entries(DEFAULT_FIELD_MAPPINGS))
                      draft[k] = v.join(", ");
                    setMappingDraft(draft);
                    toast.success("Reset to default mappings");
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-dashed border-[#e0e0e0] text-[#9b9b9b] hover:text-[#111] hover:border-[#111] transition-colors"
                >
                  Reset to defaults
                </button>
              </div>
            </div>

            {/* Field mapping rows */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-[#9b9b9b] uppercase tracking-widest">
                Field Mappings
              </p>
              <div className="rounded-xl border border-[#efefef] overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-[#efefef]">
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider w-36">
                        VoiceOS Field
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">
                        Candidate Keys (comma-separated, first match wins)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f5f5]">
                    {Object.keys(DEFAULT_FIELD_MAPPINGS).map((field) => (
                      <tr key={field}>
                        <td className="px-3 py-2">
                          <code className="text-[11px] font-mono font-semibold text-[#555]">
                            {field}
                          </code>
                        </td>
                        <td className="px-3 py-1.5">
                          <input
                            className="w-full h-7 rounded border border-[#e8e8e8] bg-white px-2.5 text-xs font-mono text-[#333] focus:outline-none focus:ring-1 focus:ring-[#111] focus:border-[#111]"
                            value={mappingDraft[field] ?? ""}
                            onChange={(e) =>
                              setMappingDraft((d) => ({
                                ...d,
                                [field]: e.target.value,
                              }))
                            }
                            placeholder={
                              DEFAULT_FIELD_MAPPINGS[field]?.join(", ") ?? ""
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                onClick={saveMappings}
                disabled={savingMappings}
                size="sm"
                className="gap-2"
              >
                {savingMappings && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Save Mappings
              </Button>
            </div>

            {/* Test extractor */}
            <div className="space-y-2 pt-2 border-t border-[#f0f0f0]">
              <p className="text-[10px] font-semibold text-[#9b9b9b] uppercase tracking-widest">
                Test Payload Extractor
              </p>
              <p className="text-xs text-[#6b6b6b]">
                Paste a sample webhook payload from your provider and see which
                VoiceOS fields would be extracted.
              </p>
              <Textarea
                rows={5}
                placeholder={
                  '{\n  "RecordingUrl": "https://…",\n  "From": "+1234567890",\n  "To": "+0987654321",\n  "CallSid": "CAxxxxxxxx",\n  "RecordingDuration": "95"\n}'
                }
                className="font-mono text-xs"
                value={testPayload}
                onChange={(e) => setTestPayload(e.target.value)}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={runTestExtraction}
                className="gap-1.5"
              >
                Run Extraction Test
              </Button>

              {testResult && (
                <div className="rounded-xl border border-[#efefef] overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#fafafa] border-b border-[#efefef]">
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider w-36">
                          Field
                        </th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold text-[#9b9b9b] uppercase tracking-wider">
                          Extracted Value
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5f5f5]">
                      {Object.entries(testResult).map(([field, val]) => (
                        <tr key={field}>
                          <td className="px-3 py-2">
                            <code className="text-[11px] font-mono text-[#555]">
                              {field}
                            </code>
                          </td>
                          <td className="px-3 py-2">
                            {val !== null ? (
                              <span className="text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                                {val}
                              </span>
                            ) : (
                              <span className="text-[10px] text-[#c0c0c0] italic">
                                not found
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Webhook URL card - platform instructions */}
      <Card className="border-dashed border-[#e0e0e0]">
        <CardContent className="py-4 px-5">
          <p className="text-xs font-semibold text-[#555] mb-2">
            Platform Setup Guides
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs text-[#6b6b6b]">
            <div>
              <p className="font-medium text-[#333] mb-1">Squaretalk</p>
              <p>
                Settings → Webhooks → Call Events → paste webhook URL. Use
                &ldquo;Squaretalk&rdquo; preset above.
              </p>
            </div>
            <div>
              <p className="font-medium text-[#333] mb-1">Voiso</p>
              <p>
                Settings → Integrations → Webhooks → Call Completed. Use
                &ldquo;Voiso&rdquo; preset above.
              </p>
            </div>
            <div>
              <p className="font-medium text-[#333] mb-1">Twilio</p>
              <p>
                Phone Numbers → Recording Status Callback. Default mappings work
                out of the box.
              </p>
            </div>
            <div>
              <p className="font-medium text-[#333] mb-1">Custom SIP / Other</p>
              <p>
                Send any JSON or form-encoded POST. Map your field names using
                the editor above.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
