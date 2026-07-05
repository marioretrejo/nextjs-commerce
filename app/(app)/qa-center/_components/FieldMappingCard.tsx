"use client";

import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_FIELD_MAPPINGS,
  PROVIDER_PRESETS,
} from "./integrations-config";

interface Props {
  showMappings: boolean;
  setShowMappings: Dispatch<SetStateAction<boolean>>;
  loadPreset: (provider: string) => void;
  mappingDraft: Record<string, string>;
  setMappingDraft: Dispatch<SetStateAction<Record<string, string>>>;
  saveMappings: () => void;
  savingMappings: boolean;
  testPayload: string;
  setTestPayload: Dispatch<SetStateAction<string>>;
  runTestExtraction: () => void;
  testResult: Record<string, string | null> | null;
}

export function FieldMappingCard({
  showMappings,
  setShowMappings,
  loadPreset,
  mappingDraft,
  setMappingDraft,
  saveMappings,
  savingMappings,
  testPayload,
  setTestPayload,
  runTestExtraction,
  testResult,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Field Mapping Engine</CardTitle>
            <CardDescription className="mt-0.5">
              Map your SIP provider's payload keys to VoiceOS fields. Each row
              is an ordered list of candidates — the first non-empty match wins.
              Works with Twilio, Squaretalk, Voiso, Genesys, and any custom SIP
              trunk.
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
  );
}
