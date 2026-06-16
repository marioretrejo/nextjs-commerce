/**
 * QA Center — Audit Log Helper
 *
 * Fire-and-forget writes to qac_audit_logs via the service-role admin client.
 * Never throws — audit failures must not break the main request flow.
 * Uses admin client to bypass RLS (audit logs are write-protected for regular users).
 */
import { createAdminClient } from "@/lib/supabase/admin";

export type QACAuditAction =
  | "analyze"
  | "interaction.create"
  | "interaction.delete"
  | "rule.create"
  | "rule.update"
  | "rule.delete"
  | "agent.create"
  | "agent.update"
  | "agent.deactivate"
  | "agent.view"
  | "coaching_report.view"
  | "coaching_report.generated"
  | "review_status.change"
  | "comment.create"
  | "violation.false_positive";

export type QACEntityType =
  | "interaction"
  | "evaluation"
  | "rule"
  | "flag"
  | "agent"
  | "coaching_report"
  | "review_comment"
  | "compliance_violation";

export interface QACAuditEntry {
  workspace_id: string;
  user_id?: string | null;
  action: QACAuditAction;
  entity_type: QACEntityType;
  entity_id?: string | null;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
}

export function writeAuditLog(entry: QACAuditEntry): void {
  const admin = createAdminClient();
  void (async () => {
    const { error } = await admin.from("qac_audit_logs").insert({
      workspace_id: entry.workspace_id,
      user_id: entry.user_id ?? null,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      details: entry.details ?? null,
      ip_address: entry.ip_address ?? null,
    });
    if (error) {
      console.error("[qac-audit] write failed:", error.message, { entry });
    }
  })();
}
