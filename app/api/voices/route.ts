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

    // Cartesia only — sonic-3/sonic-3.5 with emotion support
    const voices = allVoices
      .filter((v) => v.provider === 'cartesia' && v.voice_id && v.preview_audio_url)
      .map((v) => ({
        voice_id: v.voice_id,
        name: v.voice_name ?? v.voice_id,
        provider: 'cartesia' as const,
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
