import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const EMOTION_MAP: Record<string, string[]> = {
  calm:        ['positivity:low'],
  sympathetic: ['positivity:low', 'sadness:low'],
  happy:       ['positivity:highest'],
  sad:         ['sadness:high'],
  angry:       ['anger:high'],
  fearful:     ['fear:high'],
  surprised:   ['surprise:positive:high'],
};

// GET — proxy a CDN preview URL (legacy / external voices)
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  if (!url.startsWith('https://storage.googleapis.com/eleven-') &&
      !url.startsWith('https://api.elevenlabs.io/') &&
      !url.startsWith('https://elevenlabs.io/') &&
      !url.startsWith('https://retell-utils-public.s3.') &&
      !url.startsWith('https://cdn.cartesia.ai/') &&
      !url.startsWith('https://storage.googleapis.com/cartesia-')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const upstream = await fetch(url);
    if (!upstream.ok) return NextResponse.json({ error: 'Preview not available' }, { status: 404 });
    const contentType = upstream.headers.get('content-type') ?? 'audio/mpeg';
    return new NextResponse(upstream.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch preview' }, { status: 500 });
  }
}

// POST { voice_id, emotion?, language? } — generate a live Cartesia TTS sample
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env['CARTESIA_API_KEY']) {
    return NextResponse.json({ error: 'Cartesia not configured' }, { status: 503 });
  }

  const { voice_id, emotion, language = 'en' } = await req.json() as {
    voice_id: string;
    emotion?: string | null;
    language?: string;
  };

  if (!voice_id) return NextResponse.json({ error: 'voice_id required' }, { status: 400 });

  const emotionTags = emotion ? (EMOTION_MAP[emotion] ?? []) : [];

  const voiceSpec: Record<string, unknown> = { mode: 'id', id: voice_id };
  if (emotionTags.length > 0) {
    voiceSpec['experimental_controls'] = { emotion: emotionTags };
  }

  const previewText =
    language.startsWith('es')
      ? 'Hola, esta es una muestra de mi voz con esta emoción seleccionada.'
      : 'Hello, this is a preview of my voice with the selected emotion applied.';

  const res = await fetch('https://api.cartesia.ai/tts/bytes', {
    method: 'POST',
    headers: {
      'X-API-Key':        process.env['CARTESIA_API_KEY'],
      'Cartesia-Version': '2024-06-10',
      'Content-Type':     'application/json',
    },
    body: JSON.stringify({
      model_id:      'sonic-3',
      transcript:    previewText,
      voice:         voiceSpec,
      output_format: { container: 'mp3', bit_rate: 128000, sample_rate: 44100 },
      language:      language.split('-')[0],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[voices/preview] Cartesia TTS failed:', res.status, text);
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 502 });
  }

  return new NextResponse(res.body, {
    headers: {
      'Content-Type':  'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}
