import type { createAdminClient } from "@/lib/supabase/admin";
import { isSafeUrl } from "@/lib/qac/ssrf";

type Admin = ReturnType<typeof createAdminClient>;

const BUCKET = "call_recordings";
const MAX_RECORDING_BYTES = 100 * 1024 * 1024; // 100 MB guard

function extFor(url?: string, contentType?: string): "mp3" | "wav" {
  if (contentType?.includes("wav")) return "wav";
  if (url && /\.wav(\?|$)/i.test(url)) return "wav";
  return "mp3";
}

function contentTypeFor(ext: "mp3" | "wav"): string {
  return ext === "wav" ? "audio/wav" : "audio/mpeg";
}

function safeSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "call";
}

/**
 * Persist an imported recording into the private `call_recordings` bucket.
 *
 * Priority: recording_base64 → download recording_url server-side → upload.
 * NEVER stores base64 in the DB. On any failure the original recording_url is
 * returned as a fallback (storagePath null) so playback can still be attempted.
 */
export async function uploadImportedRecording(params: {
  admin: Admin;
  workspaceId: string;
  externalCallId: string;
  recordingBase64?: string;
  recordingUrl?: string;
}): Promise<{ storagePath: string | null; recordingUrl: string | null }> {
  const { admin, workspaceId, externalCallId, recordingBase64, recordingUrl } =
    params;

  let buffer: Buffer | null = null;
  let ext: "mp3" | "wav" = "mp3";

  // 1. Inline base64 audio
  if (recordingBase64 && recordingBase64.trim().length > 0) {
    try {
      // Strip any data: URI prefix
      const b64 = recordingBase64.replace(/^data:[^;]+;base64,/, "");
      const buf = Buffer.from(b64, "base64");
      if (buf.length > 0 && buf.length <= MAX_RECORDING_BYTES) {
        buffer = buf;
        ext = extFor(undefined, undefined);
      }
    } catch {
      buffer = null;
    }
  }

  // 2. Download recording_url server-side (SSRF-guarded)
  if (!buffer && recordingUrl && isSafeUrl(recordingUrl)) {
    try {
      const res = await fetch(recordingUrl, {
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) {
        const arr = await res.arrayBuffer();
        if (arr.byteLength > 0 && arr.byteLength <= MAX_RECORDING_BYTES) {
          buffer = Buffer.from(arr);
          ext = extFor(
            recordingUrl,
            res.headers.get("content-type") ?? undefined,
          );
        }
      }
    } catch {
      buffer = null;
    }
  }

  // 3. Upload to Storage if we obtained bytes
  if (buffer) {
    const path = `imports/${workspaceId}/${safeSegment(externalCallId)}.${ext}`;
    try {
      const { error } = await admin.storage.from(BUCKET).upload(path, buffer, {
        contentType: contentTypeFor(ext),
        upsert: true,
      });
      if (!error) {
        return { storagePath: path, recordingUrl: recordingUrl ?? null };
      }
      console.error("[call-import] recording upload failed:", error.message);
    } catch (err) {
      console.error("[call-import] recording upload threw:", err);
    }
  }

  // 4. Fallback: keep the original URL (never store base64 in the DB)
  return { storagePath: null, recordingUrl: recordingUrl ?? null };
}
