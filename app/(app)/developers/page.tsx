"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Download,
  Code2,
  Globe,
  Webhook,
  Phone,
  AlertTriangle,
  BookOpen,
  FileJson,
  FileText,
} from "lucide-react";

import type { ApiKey } from "./_components/types";
import { CodeBlock, EndpointCard, StatusBadge } from "./_components/ui";
import {
  curlOutbound,
  nodeOutbound,
  pythonOutbound,
  curlWebhook,
  nodeWebhookVerify,
  buildMarkdownDocs,
  buildPostmanCollection,
  downloadJson,
  downloadText,
} from "./_components/snippets";

export default function DevelopersPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [codeTab, setCodeTab] = useState<"curl" | "node" | "python">("curl");
  const [openApiSpec, setOpenApiSpec] = useState<Record<
    string,
    unknown
  > | null>(null);

  const displayKey =
    generatedKey ??
    (keys[0] ? `${keys[0]?.key_prefix}...` : "vos_live_YOUR_API_KEY");

  const fetchKeys = useCallback(async () => {
    const res = await fetch("/api/settings/api-keys");
    if (res.ok) setKeys(((await res.json()) as { keys: ApiKey[] }).keys);
    setLoadingKeys(false);
  }, []);

  useEffect(() => {
    fetchKeys();
    fetch("/openapi.json")
      .then((r) => r.json())
      .then((d) => setOpenApiSpec(d as Record<string, unknown>))
      .catch(() => null);
  }, [fetchKeys]);

  async function createKey() {
    if (!newKeyName.trim()) {
      toast.error("Name required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      const d = (await res.json()) as { key: string };
      setGeneratedKey(d.key);
      setNewKeyName("");
      await fetchKeys();
      setCreateOpen(false);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(id: string) {
    setDeletingId(id);
    await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
    setKeys((k) => k.filter((key) => key.id !== id));
    toast.success("Key revoked");
    setDeletingId(null);
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownloadPostman() {
    if (!openApiSpec) {
      toast.error("Spec not loaded");
      return;
    }
    const collection = await buildPostmanCollection(openApiSpec, displayKey);
    downloadJson(collection, "voiceos-postman.json");
    toast.success("Postman collection downloaded");
  }

  function handleDownloadOpenApi() {
    if (!openApiSpec) {
      toast.error("Spec not loaded");
      return;
    }
    downloadJson(openApiSpec, "voiceos-openapi.json");
    toast.success("OpenAPI spec downloaded");
  }

  function handleDownloadMarkdown() {
    downloadText(
      buildMarkdownDocs(displayKey),
      "voiceos-api-docs.md",
      "text/markdown",
    );
    toast.success("Markdown docs downloaded");
  }

  const codeExamples: Record<
    "outbound" | "webhook" | "verify",
    Record<string, string>
  > = {
    outbound: {
      curl: curlOutbound(displayKey),
      node: nodeOutbound(displayKey),
      python: pythonOutbound(displayKey),
    },
    webhook: {
      curl: curlWebhook(displayKey),
      node: nodeWebhookVerify("YOUR_WEBHOOK_SECRET"),
      python: `import requests

response = requests.post(
    'https://app.voiceos.ai/api/v1/webhooks',
    headers={'Authorization': 'Bearer ${displayKey}'},
    json={
        'url': 'https://your-server.com/webhooks/voiceos',
        'events': ['call.completed', 'call.failed'],
    },
)
data = response.json()
print(data['secret'])  # Store this securely!`,
    },
    verify: {
      curl: `# Verify in your webhook handler (bash/curl):
# Read the raw body and signature, then:
BODY='{"event":"call.completed",...}'
SIG="t=1716000000,v1=abc123..."
SECRET="YOUR_WEBHOOK_SECRET"

# Extract ts and sig
TS=$(echo $SIG | grep -o 't=[^,]*' | cut -d= -f2)
V1=$(echo $SIG | grep -o 'v1=.*' | cut -d= -f2)

# Compute expected
EXPECTED=$(echo -n "$TS.$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')
[ "$EXPECTED" = "$V1" ] && echo "Valid" || echo "Invalid"`,
      node: nodeWebhookVerify("YOUR_WEBHOOK_SECRET"),
      python: `import hmac, hashlib, time

def verify_webhook(raw_body: bytes, signature: str, secret: str) -> bool:
    parts = dict(p.split('=', 1) for p in signature.split(','))
    ts = parts.get('t', '')
    received = parts.get('v1', '')

    # Reject stale events (> 5 min)
    if abs(time.time() - float(ts)) > 300:
        return False

    expected = hmac.new(
        secret.encode(),
        f"{ts}.".encode() + raw_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected, received)

# Flask example:
from flask import Flask, request, abort
app = Flask(__name__)

@app.route('/webhooks/voiceos', methods=['POST'])
def handle_webhook():
    sig = request.headers.get('X-VoiceOS-Signature', '')
    if not verify_webhook(request.data, sig, 'YOUR_WEBHOOK_SECRET'):
        abort(401)
    event = request.json
    print(event['event'], event.get('call_id'))
    return '', 200`,
    },
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
          Developer Portal
        </h1>
        <p className="mt-1 text-sm text-[#6b6b6b]">
          API keys, reference documentation, and code examples for integrating
          VoiceOS.
        </p>
      </div>

      <Tabs defaultValue="reference">
        <TabsList className="mb-6">
          <TabsTrigger value="keys" className="flex items-center gap-2">
            <Key className="h-4 w-4" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="reference" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> API Reference
          </TabsTrigger>
        </TabsList>

        {/* ── API Keys tab ──────────────────────────────────────────────── */}
        <TabsContent value="keys">
          {generatedKey && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-800 text-sm">
                  Copy this key now — it won&apos;t be shown again.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 bg-white border border-amber-200 rounded px-3 py-1.5 text-xs font-mono text-[#0a0a0a] truncate">
                    {generatedKey}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyKey(generatedKey)}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Access Keys</CardTitle>
                <CardDescription>
                  Authenticate API requests with Bearer tokens.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Key
              </Button>
            </CardHeader>
            <CardContent>
              {loadingKeys ? (
                <div className="flex items-center gap-2 text-sm text-[#6b6b6b]">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : keys.length === 0 ? (
                <div className="text-center py-12 text-[#6b6b6b]">
                  <Key className="h-10 w-10 mx-auto mb-3 text-[#e0e0e0]" />
                  <p className="font-medium text-[#0a0a0a] mb-1">
                    No API keys yet
                  </p>
                  <p className="text-sm mb-4">
                    Create your first key to start making API calls.
                  </p>
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" /> Create Key
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-[#f0f0f0]">
                  {keys.map((k) => (
                    <div
                      key={k.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#0a0a0a]">
                          {k.name}
                        </p>
                        <p className="text-xs text-[#6b6b6b] font-mono mt-0.5">
                          {k.key_prefix}••••••••
                        </p>
                        {k.last_used_at && (
                          <p className="text-xs text-[#a0a0a0] mt-0.5">
                            Last used{" "}
                            {new Date(k.last_used_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        disabled={deletingId === k.id}
                        onClick={() => deleteKey(k.id)}
                      >
                        {deletingId === k.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create API Key</DialogTitle>
                <DialogDescription>
                  Give this key a descriptive name (e.g. &quot;Production
                  Server&quot;, &quot;CI/CD Pipeline&quot;).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label>Key name</Label>
                <Input
                  placeholder="Production Server"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createKey()}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={createKey}
                  disabled={creating || !newKeyName.trim()}
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ── API Reference tab ──────────────────────────────────────────── */}
        <TabsContent value="reference">
          {/* Download bar */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-sm font-medium text-[#6b6b6b] mr-1">
              Download:
            </span>
            <Button size="sm" variant="outline" onClick={handleDownloadOpenApi}>
              <FileJson className="h-3.5 w-3.5 mr-1.5" /> OpenAPI Spec
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownloadPostman}>
              <Globe className="h-3.5 w-3.5 mr-1.5" /> Postman Collection
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadMarkdown}
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Markdown Docs
            </Button>
          </div>

          {/* Auth section */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-[#0a0a0a]" />
                <CardTitle className="text-base">Authentication</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-[#6b6b6b]">
                All API requests must include an{" "}
                <code className="bg-[#f5f5f5] px-1 rounded text-xs font-mono">
                  Authorization
                </code>{" "}
                header:
              </p>
              <CodeBlock
                code={`Authorization: Bearer ${displayKey}`}
                language="http"
              />
              <p className="text-xs text-[#a0a0a0]">
                Keys are workspace-scoped. Generate them from{" "}
                <strong>Settings → API Keys</strong>.
              </p>
            </CardContent>
          </Card>

          {/* Rate limits section */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-[#0a0a0a]" />
                <CardTitle className="text-base">Rate Limits</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-[#6b6b6b]">
                Limits apply per workspace (not per IP). Standard:{" "}
                <strong>10 req/s</strong>, burst up to <strong>50</strong>.
              </p>
              <div className="rounded-xl border border-[#e0e0e0] overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-[#f5f5f5] border-b border-[#e0e0e0]">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b6b]">
                        Header
                      </th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b6b]">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0f0]">
                    {[
                      ["X-RateLimit-Limit", "Max requests per window"],
                      [
                        "X-RateLimit-Remaining",
                        "Requests remaining in current window",
                      ],
                      [
                        "X-RateLimit-Reset",
                        "Unix timestamp when window resets",
                      ],
                      ["Retry-After", "Seconds to wait (429 responses only)"],
                    ].map(([h, d]) => (
                      <tr key={h}>
                        <td className="px-4 py-2.5 font-mono text-xs text-[#0a0a0a]">
                          {h}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-[#6b6b6b]">
                          {d}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Endpoints */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="h-4 w-4 text-[#0a0a0a]" />
              <h2 className="text-base font-semibold text-[#0a0a0a]">Calls</h2>
            </div>

            <EndpointCard
              method="POST"
              path="/api/v1/calls/outbound"
              summary="Initiate an outbound call"
              description="Triggers an AI-powered outbound call to the specified phone number using your configured agent."
            >
              {/* Code tabs */}
              <div>
                <div className="flex gap-1 mb-2">
                  {(["curl", "node", "python"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setCodeTab(lang)}
                      className={`px-3 py-1 text-xs rounded font-medium transition-colors ${codeTab === lang ? "bg-[#0a0a0a] text-white" : "text-[#6b6b6b] hover:bg-[#f0f0f0]"}`}
                    >
                      {lang === "node"
                        ? "Node.js"
                        : lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </button>
                  ))}
                </div>
                <CodeBlock
                  code={codeExamples.outbound[codeTab] ?? ""}
                  language={codeTab === "node" ? "javascript" : codeTab}
                />
              </div>

              {/* Request params */}
              <div>
                <p className="text-xs font-semibold text-[#0a0a0a] mb-2 uppercase tracking-wide">
                  Request Body
                </p>
                <div className="rounded-xl border border-[#e0e0e0] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[#f5f5f5] border-b border-[#e0e0e0]">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b6b]">
                          Field
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b6b]">
                          Type
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b6b]">
                          Required
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-medium text-[#6b6b6b]">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f0f0] text-xs">
                      {[
                        [
                          "to",
                          "string",
                          "✓",
                          "Recipient phone in E.164 format (e.g. +12025551234)",
                        ],
                        [
                          "agentId",
                          "string (UUID)",
                          "✓",
                          "UUID of the VoiceOS agent to use",
                        ],
                        [
                          "from",
                          "string",
                          "—",
                          "Caller ID override. Defaults to workspace default number.",
                        ],
                        [
                          "variables",
                          "object",
                          "—",
                          "Key-value pairs injected into agent prompt at runtime",
                        ],
                      ].map(([f, t, r, d]) => (
                        <tr key={f}>
                          <td className="px-4 py-2.5 font-mono text-[#0a0a0a]">
                            {f}
                          </td>
                          <td className="px-4 py-2.5 text-[#6b6b6b]">{t}</td>
                          <td className="px-4 py-2.5">
                            {r === "✓" ? (
                              <Badge className="bg-[#0a0a0a] text-white text-[10px]">
                                required
                              </Badge>
                            ) : (
                              <span className="text-[#a0a0a0]">optional</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[#6b6b6b]">{d}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Responses */}
              <div>
                <p className="text-xs font-semibold text-[#0a0a0a] mb-2 uppercase tracking-wide">
                  Responses
                </p>
                <div className="space-y-2">
                  {[
                    {
                      code: 200,
                      desc: "Call initiated. Returns call_id, room_name, status.",
                    },
                    {
                      code: 400,
                      desc: "Invalid body — bad phone number format or missing agentId.",
                    },
                    { code: 401, desc: "Missing or invalid API key." },
                    {
                      code: 403,
                      desc: "Workspace suspended or minute limit reached.",
                    },
                    {
                      code: 429,
                      desc: "Concurrent call limit or rate limit exceeded.",
                    },
                    { code: 502, desc: "Twilio failed to initiate the call." },
                  ].map((r) => (
                    <div
                      key={r.code}
                      className="flex items-center gap-3 text-xs"
                    >
                      <StatusBadge code={r.code} />
                      <span className="text-[#6b6b6b]">{r.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </EndpointCard>
          </div>

          {/* Webhooks section */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Webhook className="h-4 w-4 text-[#0a0a0a]" />
              <h2 className="text-base font-semibold text-[#0a0a0a]">
                Webhooks
              </h2>
            </div>

            <EndpointCard
              method="GET"
              path="/api/v1/webhooks"
              summary="List endpoints"
              description="Returns all webhook endpoints registered for your workspace. Secrets are never returned in list responses."
            >
              <CodeBlock
                code={`curl https://app.voiceos.ai/api/v1/webhooks \\\n  -H "Authorization: Bearer ${displayKey}"`}
                language="curl"
              />
            </EndpointCard>

            <EndpointCard
              method="POST"
              path="/api/v1/webhooks"
              summary="Register an endpoint"
              description="Creates a webhook endpoint. The signing secret is returned ONLY in this response — store it in your secrets manager immediately. Events: call.completed, call.started, call.failed, campaign.run_complete, * (all)."
            >
              <div>
                <div className="flex gap-1 mb-2">
                  {(["curl", "node", "python"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setCodeTab(lang)}
                      className={`px-3 py-1 text-xs rounded font-medium transition-colors ${codeTab === lang ? "bg-[#0a0a0a] text-white" : "text-[#6b6b6b] hover:bg-[#f0f0f0]"}`}
                    >
                      {lang === "node"
                        ? "Node.js"
                        : lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </button>
                  ))}
                </div>
                <CodeBlock
                  code={codeExamples.webhook[codeTab] ?? ""}
                  language={codeTab === "node" ? "javascript" : codeTab}
                />
              </div>
            </EndpointCard>

            <EndpointCard
              method="PATCH"
              path="/api/v1/webhooks/{id}"
              summary="Update an endpoint"
              description="Update the URL, event subscriptions, description, or active status of an endpoint."
            >
              <CodeBlock
                code={`curl -X PATCH https://app.voiceos.ai/api/v1/webhooks/{id} \\\n  -H "Authorization: Bearer ${displayKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"is_active":false}'`}
                language="curl"
              />
            </EndpointCard>

            <EndpointCard
              method="DELETE"
              path="/api/v1/webhooks/{id}"
              summary="Delete an endpoint"
              description="Permanently deletes the webhook endpoint. Deliveries in-flight will not be affected."
            >
              <CodeBlock
                code={`curl -X DELETE https://app.voiceos.ai/api/v1/webhooks/{id} \\\n  -H "Authorization: Bearer ${displayKey}"`}
                language="curl"
              />
            </EndpointCard>
          </div>

          {/* Webhook Signatures */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-[#0a0a0a]" />
                <CardTitle className="text-base">
                  Webhook Signature Verification
                </CardTitle>
              </div>
              <CardDescription>
                Every delivery includes{" "}
                <code className="text-xs bg-[#f5f5f5] px-1 rounded font-mono">
                  X-VoiceOS-Signature: t=&#123;ts&#125;,v1=&#123;hmac&#125;
                </code>
                . Verify it to reject forged requests.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-[#e0e0e0] bg-[#f9f9f9] p-4 space-y-2">
                <p className="text-xs font-semibold text-[#0a0a0a]">
                  Algorithm
                </p>
                <ol className="text-xs text-[#6b6b6b] space-y-1 list-decimal list-inside">
                  <li>
                    Extract <code className="font-mono">t</code> and{" "}
                    <code className="font-mono">v1</code> from the header.
                  </li>
                  <li>
                    Reject if <code className="font-mono">t</code> is older than
                    5 minutes (replay protection).
                  </li>
                  <li>
                    Concatenate:{" "}
                    <code className="font-mono">
                      &quot;&#123;t&#125;.&#123;rawBody&#125;&quot;
                    </code>
                  </li>
                  <li>
                    Compute{" "}
                    <code className="font-mono">
                      HMAC-SHA256(secret, concatenated)
                    </code>
                  </li>
                  <li>
                    Compare with <code className="font-mono">v1</code> using
                    constant-time comparison.
                  </li>
                </ol>
              </div>
              <Separator />
              <div>
                <div className="flex gap-1 mb-2">
                  {(["curl", "node", "python"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setCodeTab(lang)}
                      className={`px-3 py-1 text-xs rounded font-medium transition-colors ${codeTab === lang ? "bg-[#0a0a0a] text-white" : "text-[#6b6b6b] hover:bg-[#f0f0f0]"}`}
                    >
                      {lang === "node"
                        ? "Node.js"
                        : lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </button>
                  ))}
                </div>
                <CodeBlock
                  code={codeExamples.verify[codeTab] ?? ""}
                  language={codeTab === "node" ? "javascript" : codeTab}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
