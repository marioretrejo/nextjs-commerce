import type { Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import type { ComplianceSettings } from "@/lib/supabase/types";

export function PrivacyTab({
  settings,
  setSettings,
  savingSettings,
  onSave,
}: {
  settings: Partial<ComplianceSettings>;
  setSettings: Dispatch<SetStateAction<Partial<ComplianceSettings>>>;
  savingSettings: boolean;
  onSave: () => void;
}) {
  return (
    <TabsContent value="privacy" className="space-y-4 pt-4">
      <Card>
        <CardHeader>
          <CardTitle>Data Retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Call Recording Retention (days)</Label>
              <Input
                type="number"
                min={1}
                max={2555}
                value={settings.call_recording_retention_days ?? 90}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    call_recording_retention_days: Number(e.target.value),
                  }))
                }
              />
              <p className="text-xs text-[#6b6b6b]">
                Recordings older than this will be automatically deleted
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Transcript Retention (days)</Label>
              <Input
                type="number"
                min={1}
                max={2555}
                value={settings.transcript_retention_days ?? 365}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    transcript_retention_days: Number(e.target.value),
                  }))
                }
              />
              <p className="text-xs text-[#6b6b6b]">
                Transcripts older than this will be automatically deleted
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consent & Compliance Frameworks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <Switch
              checked={!!settings.require_consent}
              onCheckedChange={(v) =>
                setSettings((s) => ({ ...s, require_consent: v }))
              }
            />
            <div>
              <Label>Require Consent Before Calling</Label>
              <p className="text-xs text-[#6b6b6b]">
                Agent will verify consent at the start of each call
              </p>
            </div>
          </div>

          {settings.require_consent && (
            <div className="space-y-1.5">
              <Label>Consent Message</Label>
              <Textarea
                rows={3}
                placeholder="This call may be recorded for quality assurance purposes. By continuing, you consent to..."
                value={settings.consent_message ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    consent_message: e.target.value,
                  }))
                }
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 rounded-lg border border-[#e0e0e0] p-4">
              <Switch
                checked={!!settings.tcpa_compliance_enabled}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, tcpa_compliance_enabled: v }))
                }
              />
              <div>
                <Label>TCPA Mode</Label>
                <p className="text-xs text-[#6b6b6b] mt-0.5">
                  US Telephone Consumer Protection Act
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[#e0e0e0] p-4">
              <Switch
                checked={!!settings.gdpr_compliance_enabled}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, gdpr_compliance_enabled: v }))
                }
              />
              <div>
                <Label>GDPR Mode</Label>
                <p className="text-xs text-[#6b6b6b] mt-0.5">
                  EU General Data Protection Regulation
                </p>
              </div>
            </div>
          </div>

          <Button onClick={onSave} disabled={savingSettings}>
            {savingSettings ? "Saving…" : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
