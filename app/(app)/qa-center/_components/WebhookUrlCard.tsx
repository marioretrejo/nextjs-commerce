"use client";

import { Globe, Copy } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  webhookUrl: string;
  copyUrl: () => void;
}

export function WebhookUrlCard({ webhookUrl, copyUrl }: Props) {
  return (
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
  );
}
