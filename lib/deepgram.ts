// contentType lets callers send mp3/wav/etc.; Deepgram nova-3 also sniffs the
// container, but sending the correct MIME is safest.
export async function transcribeAudio(
  audioBuffer: Buffer,
  language = "es",
  contentType = "audio/wav",
): Promise<string> {
  const response = await fetch(
    `https://api.deepgram.com/v1/listen?model=nova-3&language=${language}`,
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env["DEEPGRAM_API_KEY"] ?? ""}`,
        "Content-Type": contentType,
      },
      body: audioBuffer,
    },
  );
  if (!response.ok) return "";
  const data = (await response.json()) as {
    results?: {
      channels?: Array<{ alternatives?: Array<{ transcript?: string }> }>;
    };
  };
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
}
