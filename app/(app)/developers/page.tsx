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
import { toast } from "sonner";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  BookOpen,
} from "lucide-react";

import type { ApiKey } from "./_components/types";
import { ReferenceTab } from "./_components/ReferenceTab";
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
        <ReferenceTab
          codeExamples={codeExamples}
          codeTab={codeTab}
          setCodeTab={setCodeTab}
          displayKey={displayKey}
          onDownloadPostman={handleDownloadPostman}
          onDownloadOpenApi={handleDownloadOpenApi}
          onDownloadMarkdown={handleDownloadMarkdown}
        />
      </Tabs>
    </div>
  );
}
