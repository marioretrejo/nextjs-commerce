/**
 * GET /api/call-provider-integrations/[id]/logs
 *
 * Recent import logs for one integration (newest first, capped at 50). Payloads
 * are omitted from the list response to keep it light and avoid echoing bodies.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { CallImportLog } from "@/lib/supabase/types";
import { authWorkspace } from "../../_lib/helpers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authWorkspace();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("call_import_logs")
    .select(
      "id, provider, external_call_id, status, message, call_id, created_at",
    )
    .eq("workspace_id", auth.workspaceId)
    .eq("integration_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const logs = (data ?? []) as Array<
    Pick<
      CallImportLog,
      | "id"
      | "provider"
      | "external_call_id"
      | "status"
      | "message"
      | "call_id"
      | "created_at"
    >
  >;
  return NextResponse.json({ logs });
}
