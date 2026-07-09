import type { createAdminClient } from "@/lib/supabase/admin";
import { isSafeUrl } from "./ssrf";

type Admin = ReturnType<typeof createAdminClient>;

const BUCKET = "call_recordings";
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;

type AudioExt = "mp3" | "wav" | "m4a" | "ogg";

function cleanBase64(value: string): string {
  return value.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
}

function extFromContentType(contentType?: string | null): AudioExt {
  const type = contentType?.toLowerCase() ?? "";
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  return "mp3";
}

function extFromUrl(
  url?: string | null,
  contentType?: string | null,
): AudioExt {
  if (/\.wav(\?|$)/i.test(url ?? "")) return "wav";
  if (/\.(ogg|oga)(\?|$)/i.test(url ?? "")) return "ogg";
  if (/\.(m4a|mp4)(\?|$)/i.test(url ?? "")) return "m4a";
  return extFromContentType(contentType);
}

function contentTypeFor(ext: AudioExt): string {
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg") return "audio/ogg";
  if (ext === "m4a") return "audio/mp4";
  return "audio/mpeg";
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "call";
}

export function qacAudioStoragePath(params: {
  workspaceId: string;
  providerSlug: string;
  externalCallId: string;
  ext: AudioExt;
}): string {
  return [
    "qac",
    safeSegment(params.workspaceId),
    safeSegment(params.providerSlug),
    `${safeSegment(params.externalCallId)}.${params.ext}`,
  ].join("/");
}

export async function uploadQacRecording(params: {
  admin: Admin;
  workspaceId: string;
  providerSlug: string;
  externalCallId: string;
  recordingBase64?: string | null;
  recordingUrl?: string | null;
}): Promise<{ storagePath: string | null; error: string | null }> {
  const { admin, recordingBase64, recordingUrl } = params;

  let buffer: Buffer | null = null;
  let ext: AudioExt = extFromUrl(recordingUrl);

  if (recordingBase64?.trim()) {
    try {
      const decoded = Buffer.from(cleanBase64(recordingBase64), "base64");
      if (decoded.length > 0 && decoded.length <= MAX_AUDIO_BYTES) {
        buffer = decoded;
      }
    } catch {
      buffer = null;
    }
  }

  if (!buffer && recordingUrl && isSafeUrl(recordingUrl)) {
    try {
      const response = await fetch(recordingUrl, {
        headers: {
          Accept: "audio/mpeg,audio/wav,audio/*,*/*",
          Referer: "https://sequoia.squaretalk.com/reporting/calls",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
        },
        signal: AbortSignal.timeout(25_000),
      });
      if (response.ok) {
        const contentType = response.headers.get("content-type");
        const arrayBuffer = await response.arrayBuffer();
        if (
          arrayBuffer.byteLength > 0 &&
          arrayBuffer.byteLength <= MAX_AUDIO_BYTES
        ) {
          buffer = Buffer.from(arrayBuffer);
          ext = extFromUrl(recordingUrl, contentType);
        }
      }
    } catch {
      buffer = null;
    }
  }

  if (!buffer) {
    return { storagePath: null, error: "No audio bytes could be stored" };
  }

  const storagePath = qacAudioStoragePath({ ...params, ext });
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: contentTypeFor(ext),
      upsert: true,
    });

  if (error) {
    return { storagePath: null, error: error.message };
  }

  return { storagePath, error: null };
}

export async function downloadQacStoredAudio(
  admin: Admin,
  storagePath: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const { data, error } = await admin.storage
    .from(BUCKET)
    .download(storagePath);
  if (error || !data) return null;
  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || contentTypeFor(extFromUrl(storagePath)),
  };
}
