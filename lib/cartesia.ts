export async function getCartesiaVoices() {
  const response = await fetch('https://api.cartesia.ai/voices', {
    headers: {
      'X-API-Key': process.env['CARTESIA_API_KEY'] ?? '',
      'Cartesia-Version': '2024-06-10',
    },
  });
  if (!response.ok) return [];
  const data = await response.json() as { voices?: unknown[] };
  return data.voices ?? [];
}

export async function createCartesiaTTSStream({
  text,
  voiceId,
  language = 'es',
  speed = 1.0,
}: {
  text: string;
  voiceId: string;
  language?: string;
  speed?: number;
}) {
  return fetch('https://api.cartesia.ai/tts/sse', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env['CARTESIA_API_KEY'] ?? '',
      'Cartesia-Version': '2024-06-10',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: 'sonic-3',
      transcript: text,
      voice: { mode: 'id', id: voiceId },
      output_format: { container: 'raw', encoding: 'pcm_f32le', sample_rate: 44100 },
      language,
      speed,
    }),
  });
}

export const VOICE_ENGINE_MAP: Record<string, string> = {
  standard:   'elevenlabs_v2',
  ultra_fast: 'cartesia_sonic3',
  premium:    'elevenlabs_v3',
};
