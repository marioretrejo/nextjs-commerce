"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  Code2,
  Download,
  FileJson,
  FileText,
  Globe,
  Key,
  Phone,
  Webhook,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CodeBlock, EndpointCard, StatusBadge } from "./ui";
import { WebhookDocs } from "./WebhookDocs";

export function ReferenceTab({
  codeExamples,
  codeTab,
  setCodeTab,
  displayKey,
  onDownloadPostman,
  onDownloadOpenApi,
  onDownloadMarkdown,
}: {
  codeExamples: Record<
    "outbound" | "webhook" | "verify",
    Record<string, string>
  >;
  codeTab: "curl" | "node" | "python";
  setCodeTab: Dispatch<SetStateAction<"curl" | "node" | "python">>;
  displayKey: string;
  onDownloadPostman: () => void;
  onDownloadOpenApi: () => void;
  onDownloadMarkdown: () => void;
}) {
  return (
    <TabsContent value="reference">
      {/* Download bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-sm font-medium text-[#6b6b6b] mr-1">
          Download:
        </span>
        <Button size="sm" variant="outline" onClick={onDownloadOpenApi}>
          <FileJson className="h-3.5 w-3.5 mr-1.5" /> OpenAPI Spec
        </Button>
        <Button size="sm" variant="outline" onClick={onDownloadPostman}>
          <Globe className="h-3.5 w-3.5 mr-1.5" /> Postman Collection
        </Button>
        <Button size="sm" variant="outline" onClick={onDownloadMarkdown}>
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
                  ["X-RateLimit-Reset", "Unix timestamp when window resets"],
                  ["Retry-After", "Seconds to wait (429 responses only)"],
                ].map(([h, d]) => (
                  <tr key={h}>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#0a0a0a]">
                      {h}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#6b6b6b]">{d}</td>
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
                <div key={r.code} className="flex items-center gap-3 text-xs">
                  <StatusBadge code={r.code} />
                  <span className="text-[#6b6b6b]">{r.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </EndpointCard>
      </div>

      <WebhookDocs
        codeExamples={codeExamples}
        codeTab={codeTab}
        setCodeTab={setCodeTab}
        displayKey={displayKey}
      />
    </TabsContent>
  );
}
