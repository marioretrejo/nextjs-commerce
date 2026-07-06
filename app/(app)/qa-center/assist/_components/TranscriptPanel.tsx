"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Loader2, MessageSquare, RefreshCw, Zap } from "lucide-react";
import { CountdownRing } from "./CountdownRing";
import { DEBOUNCE_MS, relativeTime } from "./config";

export function TranscriptPanel({
  transcript,
  active,
  countdown,
  analyzing,
  lastAnalyzedAt,
  suggestedResponse,
  onChange,
  onManualAnalyze,
  onClear,
  onCopy,
}: {
  transcript: string;
  active: boolean;
  countdown: number;
  analyzing: boolean;
  lastAnalyzedAt: Date | null;
  suggestedResponse: string;
  onChange: (value: string) => void;
  onManualAnalyze: () => void;
  onClear: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="lg:col-span-3 space-y-4">
      <Card className="border-[#efefef]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#6b6b6b]" />
              Transcript
            </CardTitle>

            <div className="flex items-center gap-2">
              {/* Countdown ring (only shows when active + typing) */}
              {active && countdown > 0 && !analyzing && (
                <div className="flex items-center gap-1.5 text-[10px] text-[#9b9b9b]">
                  <CountdownRing fraction={countdown} />
                  <span>
                    analyzing in {Math.ceil((countdown * DEBOUNCE_MS) / 1000)}s
                  </span>
                </div>
              )}

              {analyzing && (
                <div className="flex items-center gap-1.5 text-xs text-[#6b6b6b]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Analyzing…</span>
                </div>
              )}

              {lastAnalyzedAt && !analyzing && (
                <span className="text-[10px] text-[#c0c0c0]">
                  Last analyzed {relativeTime(lastAnalyzedAt)}
                </span>
              )}
            </div>
          </div>
          {active && (
            <p className="text-[11px] text-[#9b9b9b] mt-0.5">
              Auto-analyzing every {DEBOUNCE_MS / 1000}s after you stop typing.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={transcript}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Paste or type the recent call transcript here…\n\nAgent: Thank you for calling, this is Maria. How can I help you today?\nCustomer: Hi, I'm calling about my account balance…\nAgent: Of course, I'd be happy to help with that…`}
            rows={14}
            className="font-mono text-[13px] resize-none focus-visible:ring-[#111]"
          />

          <div className="flex items-center gap-2">
            <Button
              onClick={onManualAnalyze}
              disabled={analyzing || transcript.trim().length < 30}
              size="sm"
              className="gap-1.5"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  Analyze Now
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={analyzing}
              className="gap-1.5 text-[#6b6b6b]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Clear
            </Button>
            <span className="ml-auto text-[10px] text-[#c0c0c0]">
              {transcript.length} chars
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Suggested Response */}
      <Card className="border-[#efefef]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#6b6b6b]" />
              Suggested Response
            </CardTitle>
            {suggestedResponse && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCopy}
                className="gap-1.5 h-7 text-xs"
              >
                <Copy className="h-3 w-3" />
                Copy
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {suggestedResponse ? (
            <div className="relative">
              <div className="rounded-xl bg-[#f8f8f8] border border-[#efefef] p-4 text-sm text-[#333] leading-relaxed whitespace-pre-wrap font-medium">
                {suggestedResponse}
              </div>
              <div className="absolute top-2 right-2">
                <Badge className="bg-green-50 text-green-700 border-green-100 text-[9px]">
                  AI Suggestion
                </Badge>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <MessageSquare className="h-8 w-8 text-[#e0e0e0] mx-auto mb-2" />
              <p className="text-sm text-[#9b9b9b]">
                {analyzing
                  ? "Generating suggested response…"
                  : "Run analysis to get a suggested response."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
