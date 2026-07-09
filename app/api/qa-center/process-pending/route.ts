import { getQacAccess } from "@/lib/qac/access";
import { processQacBacklog } from "@/lib/qac/pipeline";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type RequestBody = {
  limit?: number;
};

async function parseLimit(req: Request, fallback: number): Promise<number> {
  try {
    const body = (await req.json()) as RequestBody;
    const limit = Number(body.limit ?? fallback);
    return Number.isFinite(limit) ? Math.max(1, Math.min(10, limit)) : fallback;
  } catch {
    return fallback;
  }
}

export async function POST(req: Request) {
  const access = await getQacAccess();
  if (!access) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized or QA Center access disabled." },
      { status: 401 },
    );
  }

  const requestedLimit = await parseLimit(req, access.isAdmin ? 5 : 3);
  const immediate = await processQacBacklog({
    workspaceId: access.workspaceId,
    limit: 1,
  });

  const backgroundLimit =
    immediate.processed > 0
      ? Math.max(0, requestedLimit - immediate.processed)
      : 0;
  if (backgroundLimit > 0) {
    after(async () => {
      await processQacBacklog({
        workspaceId: access.workspaceId,
        limit: backgroundLimit,
      });
      revalidatePath("/qa-center");
      revalidatePath("/qa-center/interactions");
    });
  }

  revalidatePath("/qa-center");
  revalidatePath("/qa-center/interactions");

  return NextResponse.json({
    ok: true,
    processed: immediate.processed,
    succeeded: immediate.succeeded,
    failed: immediate.failed,
    queued: backgroundLimit,
    results: immediate.results,
  });
}
