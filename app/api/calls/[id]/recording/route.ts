/**
 * GET /api/calls/[id]/recording[?download=1]
 *
 * Returns the call recording as a redirect to a short-lived signed URL. Access
 * is gated by the session (calls RLS scopes the row to the user's workspace);
 * the signed URL itself is minted with the admin client so imported recordings
 * (whose Storage paths don't embed an agent id) are still reachable.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Extract the object path within the `call_recordings` bucket from a URL. */
function extractStoragePath(rawUrl: string): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("s3://")) return rawUrl.replace(/^s3:\/\/[^/]+\//, "");
  if (rawUrl.includes("call_recordings/")) {
    return rawUrl.split("call_recordings/")[1] ?? null;
  }
  if (!rawUrl.startsWith("http")) return rawUrl;
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // RLS scopes this to the caller's workspace.
  const { data, error } = await supabase
    .from("calls")
    .select("id, recording_url, recording_storage_path")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const call = data as {
    recording_url: string | null;
    recording_storage_path: string | null;
  };

  const storagePath =
    call.recording_storage_path ??
    (call.recording_url ? extractStoragePath(call.recording_url) : null);

  const download = new URL(req.url).searchParams.has("download");

  if (storagePath) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from("call_recordings")
      .createSignedUrl(
        storagePath,
        3600,
        download ? { download: `call-${id}.mp3` } : undefined,
      );
    if (signed?.signedUrl) {
      return NextResponse.redirect(signed.signedUrl);
    }
  }

  // Fallback: an external recording URL we never mirrored into Storage.
  if (call.recording_url && /^https?:\/\//.test(call.recording_url)) {
    return NextResponse.redirect(call.recording_url);
  }

  return NextResponse.json({ error: "No recording" }, { status: 404 });
}
