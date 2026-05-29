const CARTESIA_BASE    = 'https://api.cartesia.ai';
const CARTESIA_VERSION = '2024-06-10';

function cartesiaHeaders(extra?: Record<string, string>) {
  return {
    'X-API-Key':        process.env['CARTESIA_API_KEY'] ?? '',
    'Cartesia-Version': CARTESIA_VERSION,
    ...extra,
  };
}

export interface CartesiaVoice {
  id:          string;
  name:        string;
  language:    string;
  is_public:   boolean;
  description: string | null;
  embedding?:  number[];
}

export async function getCartesiaVoices(): Promise<CartesiaVoice[]> {
  const response = await fetch(`${CARTESIA_BASE}/voices`, {
    headers: cartesiaHeaders(),
  });
  if (!response.ok) return [];
  const data = await response.json() as CartesiaVoice[] | { voices?: CartesiaVoice[] };
  // API may return array directly or wrapped in { voices: [] }
  return Array.isArray(data) ? data : (data.voices ?? []);
}

/**
 * Clone a voice from an audio clip.
 * mode: 'similarity'    — fastest, best for 1–3 min clips
 *       'reconstruction' — best quality, needs transcript
 */
export async function cloneCartesiaVoice({
  name,
  language = 'en',
  mode     = 'similarity',
  file,
  transcript,
}: {
  name:        string;
  language?:   string;
  mode?:       'similarity' | 'reconstruction';
  file:        File;
  transcript?: string;
}): Promise<{ id: string; name: string }> {
  const form = new FormData();
  form.append('clip',     file);
  form.append('name',     name);
  form.append('language', language);
  form.append('mode',     mode);
  if (transcript && mode === 'reconstruction') form.append('transcript', transcript);

  const res = await fetch(`${CARTESIA_BASE}/voices/clone`, {
    method:  'POST',
    headers: cartesiaHeaders(), // no Content-Type — let browser set multipart boundary
    body:    form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cartesia clone failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<{ id: string; name: string }>;
}

export async function deleteCartesiaVoice(voiceId: string): Promise<void> {
  const res = await fetch(`${CARTESIA_BASE}/voices/${voiceId}`, {
    method:  'DELETE',
    headers: cartesiaHeaders(),
  });
  // 404 is fine — voice may already be gone
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Cartesia delete failed (${res.status}): ${text}`);
  }
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
