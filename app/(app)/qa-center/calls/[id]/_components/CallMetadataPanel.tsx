"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  ArrowRight,
  Clock,
  Globe,
  Loader2,
  MessageSquare,
  Phone,
  Shield,
  TrendingUp,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QACInteraction, QACEvaluation, QACAuditLog } from "./types";
import { formatDuration } from "./format";
import { AUDIT_ACTION_LABELS } from "./config";

const CHANNEL_ICON: Record<string, ReactNode> = {
  call: <Phone className="h-3.5 w-3.5" />,
  chat: <MessageSquare className="h-3.5 w-3.5" />,
  email: <MessageSquare className="h-3.5 w-3.5" />,
  sms: <MessageSquare className="h-3.5 w-3.5" />,
  social: <Globe className="h-3.5 w-3.5" />,
  other: <Phone className="h-3.5 w-3.5" />,
};

interface Props {
  interaction: QACInteraction;
  evaluation: QACEvaluation | undefined;
  auditLogs: QACAuditLog[];
  auditLogsHasMore: boolean;
  loadMoreAuditLogs: () => void;
  loadingMoreAudit: boolean;
}

export function CallMetadataPanel({
  interaction,
  evaluation,
  auditLogs,
  auditLogsHasMore,
  loadMoreAuditLogs,
  loadingMoreAudit,
}: Props) {
  return (
    <>
      {/* ── Call metadata ────────────────────────────────────────────── */}
      <Card className="border-[#efefef]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-[#6b6b6b] font-medium">
            Call Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
            {[
              {
                label: "Agent",
                value: interaction.agent_name,
                icon: <User className="h-3.5 w-3.5" />,
              },
              {
                label: "Agent ID",
                value: interaction.agent_id ?? "—",
                icon: <User className="h-3.5 w-3.5" />,
              },
              {
                label: "Channel",
                value: interaction.channel,
                icon: CHANNEL_ICON[interaction.channel] ?? (
                  <Phone className="h-3.5 w-3.5" />
                ),
              },
              {
                label: "Direction",
                value: interaction.direction ?? "—",
                icon: <ArrowRight className="h-3.5 w-3.5" />,
              },
              {
                label: "Duration",
                value: interaction.duration_s
                  ? formatDuration(interaction.duration_s)
                  : "—",
                icon: <Clock className="h-3.5 w-3.5" />,
              },
              {
                label: "Language",
                value: interaction.language ?? "—",
                icon: <Globe className="h-3.5 w-3.5" />,
              },
              {
                label: "Customer",
                value: interaction.customer_id ?? "—",
                icon: <User className="h-3.5 w-3.5" />,
              },
              {
                label: "Campaign",
                value: interaction.campaign ?? "—",
                icon: <TrendingUp className="h-3.5 w-3.5" />,
              },
            ].map(({ label, value, icon }) => (
              <div key={label} className="flex items-start gap-2">
                <span className="text-[#9b9b9b] mt-0.5 shrink-0">{icon}</span>
                <div>
                  <dt className="text-[10px] font-medium text-[#9b9b9b] uppercase tracking-wider">
                    {label}
                  </dt>
                  <dd className="text-sm font-medium text-[#111] capitalize">
                    {value}
                  </dd>
                </div>
              </div>
            ))}
          </dl>

          <div className="mt-4 pt-4 border-t border-[#f0f0f0] flex items-center gap-4 text-[10px] text-[#9b9b9b]">
            <span>
              Created{" "}
              {format(new Date(interaction.created_at), "MMM d, yyyy HH:mm")}
            </span>
            {evaluation && (
              <span>
                Analyzed{" "}
                {format(new Date(evaluation.evaluated_at), "MMM d, yyyy HH:mm")}
              </span>
            )}
            {evaluation && (
              <span>
                {evaluation.rules_applied} QA rule
                {evaluation.rules_applied !== 1 ? "s" : ""} applied
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {auditLogs.length > 0 && (
        <Card className="border-[#efefef]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#6b6b6b]" />
                Audit Trail
              </span>
              <Link
                href="/qa-center/audit"
                className="text-[11px] text-[#9b9b9b] hover:text-[#555] font-normal flex items-center gap-1"
              >
                View all
                <ArrowRight className="h-3 w-3" />
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditLogs.map((log) => {
                const detail =
                  log.action === "review_status.change" && log.details
                    ? `${String((log.details as { from?: string }).from ?? "")} → ${String((log.details as { to?: string }).to ?? "")}`
                    : null;
                return (
                  <div
                    key={log.id}
                    className="flex items-baseline gap-2.5 text-xs"
                  >
                    <span className="text-[#b0b0b0] tabular-nums shrink-0">
                      {format(new Date(log.created_at), "MMM d HH:mm")}
                    </span>
                    <span className="font-medium text-[#333]">
                      {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                    </span>
                    {detail && <span className="text-[#9b9b9b]">{detail}</span>}
                  </div>
                );
              })}
              {auditLogsHasMore && (
                <button
                  onClick={() => void loadMoreAuditLogs()}
                  disabled={loadingMoreAudit}
                  className="mt-1 text-[11px] text-[#6b6b6b] hover:text-[#111] flex items-center gap-1 disabled:opacity-50"
                >
                  {loadingMoreAudit ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : null}
                  Cargar más
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
