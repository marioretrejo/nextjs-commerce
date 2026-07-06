import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TabsContent } from "@/components/ui/tabs";
import type { useCompliance } from "../_components/useCompliance";

export function PanelPrivacyTab({
  c,
}: {
  c: ReturnType<typeof useCompliance>;
}) {
  const { settings, setSettings } = c;
  return (
    <TabsContent value="privacy" className="space-y-4 pt-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Data Retention</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Recording Retention (days)</Label>
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
              <p className="text-xs text-[#9b9b9b]">
                Recordings older than this are auto-deleted
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
              <p className="text-xs text-[#9b9b9b]">
                Transcripts older than this are auto-deleted
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Consent &amp; Frameworks</CardTitle>
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
              <p className="text-xs text-[#9b9b9b]">
                Agent verifies consent at the start of each call
              </p>
            </div>
          </div>
          {settings.require_consent && (
            <div className="space-y-1.5">
              <Label>Consent Message</Label>
              <Textarea
                rows={3}
                placeholder="This call may be recorded for quality assurance purposes…"
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
            <div className="flex items-center gap-3 rounded-lg border border-[#e8e8e8] p-4">
              <Switch
                checked={!!settings.tcpa_compliance_enabled}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, tcpa_compliance_enabled: v }))
                }
              />
              <div>
                <Label>TCPA Mode</Label>
                <p className="text-xs text-[#9b9b9b] mt-0.5">
                  US Telephone Consumer Protection Act
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[#e8e8e8] p-4">
              <Switch
                checked={!!settings.gdpr_compliance_enabled}
                onCheckedChange={(v) =>
                  setSettings((s) => ({ ...s, gdpr_compliance_enabled: v }))
                }
              />
              <div>
                <Label>GDPR Mode</Label>
                <p className="text-xs text-[#9b9b9b] mt-0.5">
                  EU General Data Protection Regulation
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={c.saveSettings}
            disabled={c.savingSettings}
            size="sm"
          >
            {c.savingSettings ? "Saving…" : "Save Settings"}
          </Button>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
