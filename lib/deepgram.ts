export interface DeepgramTranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface DeepgramTranscriptResult {
  transcript: string;
  segments: DeepgramTranscriptSegment[];
}

interface DeepgramResponse {
  results?: {
    channels?: Array<{ alternatives?: Array<{ transcript?: string }> }>;
    utterances?: Array<{
      speaker?: number | string;
      start?: number;
      end?: number;
      transcript?: string;
    }>;
  };
}

function labelSpeaker(
  speaker: number | string | undefined,
  speakerMap: Map<string, string>,
  direction?: string | null,
): string {
  const key = String(speaker ?? speakerMap.size);
  const existing = speakerMap.get(key);
  if (existing) return existing;

  const firstLabel = direction === "inbound" ? "Cliente" : "Agente";
  const secondLabel = firstLabel === "Agente" ? "Cliente" : "Agente";
  const label = speakerMap.size === 0 ? firstLabel : secondLabel;
  speakerMap.set(key, label);
  return label;
}

// contentType lets callers send mp3/wav/etc.; Deepgram nova-3 also sniffs the
// container, but sending the correct MIME is safest.
export async function transcribeAudioDetailed(
  audioBuffer: Buffer,
  language = "es",
  contentType = "audio/wav",
  direction?: string | null,
): Promise<DeepgramTranscriptResult> {
  const response = await fetch(
    `https://api.deepgram.com/v1/listen?model=nova-3&language=${language}&smart_format=true&punctuate=true&diarize=true&utterances=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env["DEEPGRAM_API_KEY"] ?? ""}`,
        "Content-Type": contentType,
      },
      body: audioBuffer,
    },
  );
  if (!response.ok) return { transcript: "", segments: [] };

  const data = (await response.json()) as DeepgramResponse;
  const transcript =
    data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
  const speakerMap = new Map<string, string>();
  const segments =
    data.results?.utterances
      ?.map((utterance) => ({
        speaker: labelSpeaker(utterance.speaker, speakerMap, direction),
        start: Number(utterance.start ?? 0),
        end: Number(utterance.end ?? utterance.start ?? 0),
        text: utterance.transcript?.trim() ?? "",
      }))
      .filter((segment) => segment.text.length > 0) ?? [];

  return { transcript, segments };
}

export async function transcribeAudio(
  audioBuffer: Buffer,
  language = "es",
  contentType = "audio/wav",
): Promise<string> {
  const result = await transcribeAudioDetailed(
    audioBuffer,
    language,
    contentType,
  );
  return result.transcript;
}
