import type { DeepgramResponse, DiarizedTranscript } from "./types";

// ─── Audio transcription with Deepgram diarization + Groq Whisper fallback ───

export async function transcribeWithDiarization(
  recordingUrl: string,
  accountSid: string | null,
  authToken: string | null,
  lang: string = "en",
): Promise<{
  transcript: string;
  diarizedTranscript: DiarizedTranscript | null;
}> {
  const mp3Url = /\.(mp3|wav|ogg|m4a|flac)$/i.test(recordingUrl)
    ? recordingUrl
    : `${recordingUrl}.mp3`;

  const downloadHeaders: Record<string, string> = {};
  if (accountSid && authToken) {
    downloadHeaders["Authorization"] =
      `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
  }

  let audioBuffer: Buffer;
  try {
    const audioRes = await fetch(mp3Url, { headers: downloadHeaders });
    if (!audioRes.ok) {
      console.error(
        "[qac-webhook] Recording download failed:",
        audioRes.status,
        mp3Url,
      );
      return { transcript: "", diarizedTranscript: null };
    }
    audioBuffer = Buffer.from(await audioRes.arrayBuffer());
  } catch (err) {
    console.error("[qac-webhook] Recording download error:", err);
    return { transcript: "", diarizedTranscript: null };
  }

  const ext = (
    mp3Url.match(/\.(mp3|wav|ogg|m4a|flac)$/i)?.[1] ?? "mp3"
  ).toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
  };
  const contentType = mimeMap[ext] ?? "audio/mpeg";

  // ── 1. Deepgram nova-3 with diarization ───────────────────────────────────
  const deepgramKey = process.env["DEEPGRAM_API_KEY"];
  if (deepgramKey) {
    try {
      const dgRes = await fetch(
        `https://api.deepgram.com/v1/listen?model=nova-3&diarize=true&utterances=true&punctuate=true&language=${lang}`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${deepgramKey}`,
            "Content-Type": contentType,
          },
          body: audioBuffer,
        },
      );

      if (dgRes.ok) {
        const dgData = (await dgRes.json()) as DeepgramResponse;
        const plainTranscript =
          dgData.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ??
          "";

        if (plainTranscript.length >= 20) {
          const rawUtterances = dgData.results?.utterances ?? [];
          const utterances = rawUtterances.map((u) => ({
            speaker: String(u.speaker),
            speaker_type: "unknown" as const,
            text: u.transcript ?? "",
            start_ms: Math.round((u.start ?? 0) * 1000),
            end_ms: Math.round((u.end ?? 0) * 1000),
            confidence: u.confidence ?? 0,
          }));

          console.info(
            "[qac-webhook] Deepgram diarization success:",
            utterances.length,
            "utterances",
          );

          return {
            transcript: plainTranscript,
            diarizedTranscript:
              utterances.length > 0
                ? {
                    provider: "deepgram",
                    model: "nova-3",
                    language: lang,
                    utterances,
                  }
                : null,
          };
        }
      } else {
        console.error(
          "[qac-webhook] Deepgram error:",
          dgRes.status,
          await dgRes.text(),
        );
      }
    } catch (err) {
      console.error("[qac-webhook] Deepgram transcription error:", err);
    }
  }

  // ── 2. Fallback: Groq Whisper (no diarization) ────────────────────────────
  const groqKey = process.env["GROQ_API_KEY"];
  if (!groqKey) return { transcript: "", diarizedTranscript: null };

  try {
    const form = new globalThis.FormData();
    form.append(
      "file",
      new Blob([audioBuffer], { type: contentType }),
      `recording.${ext}`,
    );
    form.append("model", "whisper-large-v3-turbo");
    form.append("response_format", "text");
    form.append("language", lang);

    const whisperRes = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: form,
      },
    );

    if (!whisperRes.ok) {
      console.error(
        "[qac-webhook] Whisper fallback error:",
        whisperRes.status,
        await whisperRes.text(),
      );
      return { transcript: "", diarizedTranscript: null };
    }

    console.info("[qac-webhook] Groq Whisper fallback used (no diarization)");
    return {
      transcript: (await whisperRes.text()).trim(),
      diarizedTranscript: null,
    };
  } catch (err) {
    console.error("[qac-webhook] Groq fallback error:", err);
    return { transcript: "", diarizedTranscript: null };
  }
}
