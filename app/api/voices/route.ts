/**
 * GET /api/voices
 *
 * Returns the public Cartesia voice library (Sonic-3 compatible voices).
 * Falls back to a curated static list if CARTESIA_API_KEY is not set,
 * so the UI is never broken in development.
 */
import { getCartesiaVoices } from '@/lib/cartesia';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Static fallback — a handful of well-known public Cartesia voices
const FALLBACK_VOICES = [
  { voice_id: '694f9389-aac1-45b6-b726-9d9369183238', name: 'Barbershop Man',  provider: 'cartesia', preview_url: '', labels: { gender: 'male',   accent: 'american', age: 'middle_aged' } },
  { voice_id: 'a0e99841-438c-4a64-b679-ae501e7d6091', name: 'Barbershop Woman',provider: 'cartesia', preview_url: '', labels: { gender: 'female',  accent: 'american', age: 'middle_aged' } },
  { voice_id: '79a125e8-cd45-4c13-8a67-188112f4dd22', name: 'British Lady',    provider: 'cartesia', preview_url: '', labels: { gender: 'female',  accent: 'british',  age: 'young'       } },
  { voice_id: '63ff761f-c1e8-414b-b969-d1833d1c870c', name: 'Confident British Man', provider: 'cartesia', preview_url: '', labels: { gender: 'male', accent: 'british', age: 'middle_aged' } },
];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env['CARTESIA_API_KEY']) {
    return NextResponse.json({ voices: FALLBACK_VOICES, source: 'fallback' });
  }

  try {
    const raw = await getCartesiaVoices();

    const voices = raw
      .filter((v) => v.is_public || v.is_public === undefined)
      .map((v) => ({
        voice_id:    v.id,
        name:        v.name,
        provider:    'cartesia' as const,
        preview_url: '',           // Cartesia doesn't return preview URLs in list endpoint
        labels: {
          gender: '',
          accent: '',
          age:    '',
        },
      }));

    return NextResponse.json({ voices: voices.length ? voices : FALLBACK_VOICES });
  } catch (e) {
    console.error('[api/voices] Cartesia fetch failed:', e);
    return NextResponse.json({ voices: FALLBACK_VOICES, source: 'fallback' });
  }
}
