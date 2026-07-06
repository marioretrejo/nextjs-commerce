"use client";

import type { Dispatch, SetStateAction } from "react";
import { Download, Webhook } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CodeBlock, EndpointCard } from "./ui";

export function WebhookDocs({
  codeExamples,
  codeTab,
  setCodeTab,
  displayKey,
}: {
  codeExamples: Record<
    "outbound" | "webhook" | "verify",
    Record<string, string>
  >;
  codeTab: "curl" | "node" | "python";
  setCodeTab: Dispatch<SetStateAction<"curl" | "node" | "python">>;
  displayKey: string;
}) {
  return (
    <>
      {/* Webhooks section */}
      <div className="space-y-4 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Webhook className="h-4 w-4 text-[#0a0a0a]" />
          <h2 className="text-base font-semibold text-[#0a0a0a]">Webhooks</h2>
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
            <p className="text-xs font-semibold text-[#0a0a0a]">Algorithm</p>
            <ol className="text-xs text-[#6b6b6b] space-y-1 list-decimal list-inside">
              <li>
                Extract <code className="font-mono">t</code> and{" "}
                <code className="font-mono">v1</code> from the header.
              </li>
              <li>
                Reject if <code className="font-mono">t</code> is older than 5
                minutes (replay protection).
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
    </>
  );
}
