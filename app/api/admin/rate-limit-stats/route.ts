/**
 * GET /api/admin/rate-limit-stats?workspaceIds=uuid1,uuid2,...
 *
 * Returns the number of 429 rejections (from Redis) for each workspace
 * in the last hour. Superadmin-only.
 */
import { getBulkRejectionCounts } from "@/lib/ratelimit";
import { requireSuperadmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const ids =
    url.searchParams.get("workspaceIds")?.split(",").filter(Boolean) ?? [];

  const counts = await getBulkRejectionCounts(ids);
  return NextResponse.json({ counts });
}
