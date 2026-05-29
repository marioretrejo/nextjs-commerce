import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const CARTESIA_API_KEY = () => process.env['CARTESIA_API_KEY'] ?? '';

// Maps our emotion names → Cartesia experimental_controls emotion tags
const EMOTION_MAP: Record<string, string[]> = {
  calm:        ['positivity:low'],
  sympathetic: ['sadness:low'],
  happy:       ['positivity:highest'],
  sad:         ['sadness:high'],
  angry:       ['anger:high'],
  fearful:     ['fearfulness:high'],
  surprised:   ['surprise:positive:high'],
};

// Build a 44-byte WAV header for raw 16-bit signed LE mono PCM
function wavHeader(pcmByteLength: number, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcmByteLength, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);           // PCM
  h.writeUInt16LE(numChannels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bitsPerSample, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcmByteLength, 40);
  return h;
}

// Call Cartesia /tts/sse, collect PCM chunks, return WAV buffer
async function generateWav(
  voiceId: string,
  emotionTags: string[],
  transcript: string,
  language: string,
): Promise<Buffer | string> {
  const voiceSpec: Record<string, unknown> = { mode: 'id', id: voiceId };
  if (emotionTags.length > 0) {
    voiceSpec['experimental_controls'] = { emotion: emotionTags };
  }

  const SAMPLE_RATE = 22050;

  const res = await fetch('https://api.cartesia.ai/tts/sse', {
    method: 'POST',
    headers: {
      'X-API-Key':        CARTESIA_API_KEY(),
      'Cartesia-Version': '2024-06-10',
      'Content-Type':     'application/json',
    },
    body: JSON.stringify({
      model_id:      'sonic-3',
      transcript,
      voice:         voiceSpec,
      output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: SAMPLE_RATE },
      language,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '(unreadable)');
    console.error(`[voices/preview] Cartesia SSE ${res.status}:`, errText);
    return `Cartesia error ${res.status}: ${errText.slice(0, 200)}`;
  }

  // Parse the SSE text stream — Cartesia closes connection after "done" event
  const bodyText = await res.text();
  const chunks: Buffer[] = [];

  for (const line of bodyText.split('\n')) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const evt = JSON.parse(payload) as { type?: string; data?: string };
      if (evt.type === 'chunk' && evt.data) {
        chunks.push(Buffer.from(evt.data, 'base64'));
      }
    } catch { /* skip malformed event */ }
  }

  if (chunks.length === 0) {
    console.error('[voices/preview] No audio chunks received. Full SSE body:', bodyText.slice(0, 500));
    return 'No audio chunks received from Cartesia';
  }

  const pcm    = Buffer.concat(chunks);
  const header = wavHeader(pcm.length, SAMPLE_RATE);
  return Buffer.concat([header, pcm]);
}

// ─── GET — proxy a CDN preview URL (legacy / external voices) ────────────────
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  const ALLOWED = [
    'https://cdn.cartesia.ai/',
    'https://storage.googleapis.com/cartesia-',
  ];
  if (!ALLOWED.some((prefix) => url.startsWith(prefix))) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return NextResponse.json({ error: 'Preview not available' }, { status: 404 });
    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type':  upstream.headers.get('content-type') ?? 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    console.error('[voices/preview] GET proxy error:', e);
    return NextResponse.json({ error: 'Failed to fetch preview' }, { status: 500 });
  }
}

// ─── POST { voice_id, emotion?, language? } — live Cartesia TTS sample ───────
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!CARTESIA_API_KEY()) {
      return NextResponse.json({ error: 'Cartesia not configured' }, { status: 503 });
    }

    const body = await req.json() as { voice_id?: string; emotion?: string | null; language?: string };
    const { voice_id, emotion, language = 'en' } = body;

    if (!voice_id) return NextResponse.json({ error: 'voice_id required' }, { status: 400 });

    const emotionTags  = emotion ? (EMOTION_MAP[emotion] ?? []) : [];
    const lang         = language.split('-')[0] ?? 'en';
    const previewText  = lang === 'es'
      ? 'Hola, esta es una muestra de mi voz.'
      : 'Hello! This is a quick preview of my voice.';

    const result = await generateWav(voice_id, emotionTags, previewText, lang);

    if (typeof result === 'string') {
      return NextResponse.json({ error: result }, { status: 502 });
    }

    return new NextResponse(result, {
      headers: {
        'Content-Type':   'audio/wav',
        'Cache-Control':  'no-store',
        'Content-Length': String(result.length),
      },
    });
  } catch (e) {
    console.error('[voices/preview] Unhandled error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
