export async function transcribeAudio(audioBuffer: Buffer, language = 'es'): Promise<string> {
  const response = await fetch(
    `https://api.deepgram.com/v1/listen?model=nova-3&language=${language}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env['DEEPGRAM_API_KEY'] ?? ''}`,
        'Content-Type': 'audio/wav',
      },
      body: audioBuffer,
    }
  );
  if (!response.ok) return '';
  const data = await response.json() as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> };
  };
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
}
