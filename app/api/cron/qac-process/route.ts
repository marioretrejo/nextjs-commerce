import { processQacBacklog } from "@/lib/qac/pipeline";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env["CRON_SECRET"];
  if (!secret) return false;
  const url = new URL(req.url);
  const auth = req.headers.get("authorization");
  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice("bearer ".length).trim()
    : null;
  return bearer === secret || url.searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 10);
  const result = await processQacBacklog({
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(25, limit)) : 10,
  });

  return NextResponse.json({ ok: true, ...result });
}

export const POST = GET;
