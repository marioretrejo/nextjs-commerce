import { getRetellClient } from '@/lib/retell/client';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const retellClient = getRetellClient();
    const allVoices = await retellClient.voice.list();

    // Only ElevenLabs voices (11labs-*) — these support eleven_v3 with emotions
    const voices = allVoices
      .filter((v) => v.provider === 'elevenlabs' && v.voice_id && v.preview_audio_url)
      .map((v) => ({
        voice_id: v.voice_id,
        name: v.voice_name ?? v.voice_id,
        preview_url: v.preview_audio_url ?? '',
        labels: {
          gender: v.gender ?? '',
          accent: v.accent ?? '',
          age: v.age ?? '',
        },
      }));

    return NextResponse.json({ voices });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
