"use client";

import { useState } from "react";
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
import { Link2, Link2Off, CheckCircle2, Settings2 } from "lucide-react";
import type { Integration, IntegrationType } from "@/lib/supabase/types";
import type { IntegrationDef } from "./catalogue";
import { statusBadge } from "./StatusBadge";

export function CredentialCard({
  def,
  integration,
  onSave,
  onDisconnect,
}: {
  def: IntegrationDef;
  integration: Integration | null;
  onSave: (
    type: IntegrationType,
    fields: Record<string, string>,
  ) => Promise<void>;
  onDisconnect: (type: IntegrationType) => Promise<void>;
}) {
  const isConnected = integration?.status === "connected";
  const creds = (integration?.credentials ?? {}) as Record<string, string>;

  // Initialise form from saved credentials
  const initial: Record<string, string> = {};
  def.form!.forEach((f) => {
    initial[f.id] = creds[f.id] ?? "";
  });

  const [fields, setFields] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(!isConnected);

  async function save() {
    setSaving(true);
    await onSave(def.type, fields);
    setSaving(false);
    setExpanded(false);
  }

  async function disconnect() {
    setSaving(true);
    await onDisconnect(def.type);
    setSaving(false);
    setExpanded(false);
  }

  const logoIsEmoji = /\p{Emoji}/u.test(def.logo);

  return (
    <Card className={isConnected ? "border-emerald-300" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg border flex items-center justify-center text-sm font-bold overflow-hidden
              ${isConnected ? "bg-emerald-50 border-emerald-200" : "bg-[#f5f5f5] border-[#e0e0e0]"}
              ${!def.logoSrc && logoIsEmoji ? "text-xl" : "text-[#0a0a0a] text-xs"}`}
            >
              {def.logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={def.logoSrc}
                  alt={def.name}
                  className="w-7 h-7 object-contain"
                />
              ) : (
                def.logo
              )}
            </div>
            <div>
              <CardTitle className="text-sm">{def.name}</CardTitle>
              {statusBadge(integration?.status ?? null)}
            </div>
          </div>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-[#6b6b6b] hover:text-[#0a0a0a] p-1 rounded"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="text-xs leading-relaxed mb-3">
          {def.description}
        </CardDescription>

        {expanded && (
          <div className="space-y-3 border-t border-[#e0e0e0] pt-3">
            {def.form!.map((f) => (
              <div key={f.id} className="space-y-1">
                <Label htmlFor={`${def.type}-${f.id}`} className="text-xs">
                  {f.label}
                </Label>
                <Input
                  id={`${def.type}-${f.id}`}
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  value={fields[f.id] ?? ""}
                  onChange={(e) =>
                    setFields((prev) => ({ ...prev, [f.id]: e.target.value }))
                  }
                  className="text-xs h-8"
                />
              </div>
            ))}

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 text-xs"
                disabled={
                  saving || !def.form!.every((f) => fields[f.id]?.trim())
                }
                onClick={save}
              >
                {saving ? "Saving…" : isConnected ? "Update" : "Connect"}
              </Button>
              {isConnected && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  disabled={saving}
                  onClick={disconnect}
                >
                  <Link2Off className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            {def.type === "telegram" && (
              <p className="text-[10px] text-[#6b6b6b] leading-relaxed">
                Create a bot via @BotFather → copy the token. Add the bot to
                your group/channel and get the Chat ID from the Telegram API or
                a bot like @userinfobot.
              </p>
            )}
            {def.type === "teams" && (
              <p className="text-[10px] text-[#6b6b6b] leading-relaxed">
                In Teams: channel → ⋯ → Connectors → Incoming Webhook → copy the
                URL.
              </p>
            )}
            {def.type === "n8n" && (
              <p className="text-[10px] text-[#6b6b6b] leading-relaxed">
                In n8n: add a Webhook trigger node → copy the "Test URL" or
                "Production URL". The full call payload (transcript, summary,
                disposition, extracted data) will be POSTed on every analyzed
                call.
              </p>
            )}
            {def.type === "google_calendar" && (
              <p className="text-[10px] text-[#6b6b6b] leading-relaxed">
                Create OAuth credentials in Google Cloud Console (scope:
                calendar.events). Use the OAuth Playground to generate a refresh
                token. Events are created automatically when disposition =
                Meeting Booked.
              </p>
            )}
          </div>
        )}

        {!expanded && isConnected && (
          <div className="flex items-center gap-1.5 text-[10px] text-emerald-600">
            <CheckCircle2 className="w-3 h-3" />
            Active — notifications will fire after each call analysis
          </div>
        )}

        {!expanded && !isConnected && (
          <Button
            size="sm"
            className="w-full text-xs mt-1"
            onClick={() => setExpanded(true)}
          >
            <Link2 className="w-3.5 h-3.5 mr-1.5" />
            Configure
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
