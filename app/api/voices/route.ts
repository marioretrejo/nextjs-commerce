import { elevenlabs } from '@/lib/elevenlabs/client';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env['ELEVENLABS_API_KEY']) {
    // Return mock voices when key not configured
    return NextResponse.json({
      voices: [
        { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', preview_url: '', category: 'premade', labels: { gender: 'female', accent: 'american' } },
        { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', preview_url: '', category: 'premade', labels: { gender: 'female', accent: 'american' } },
        { voice_id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi', preview_url: '', category: 'premade', labels: { gender: 'female', accent: 'american' } },
        { voice_id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', preview_url: '', category: 'premade', labels: { gender: 'female', accent: 'american' } },
        { voice_id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', preview_url: '', category: 'premade', labels: { gender: 'male', accent: 'american' } },
        { voice_id: 'VR6AewLTigWG4xSOukaG', name: 'Arnold', preview_url: '', category: 'premade', labels: { gender: 'male', accent: 'american' } }
      ]
    });
  }

  try {
    const data = await elevenlabs.listVoices();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
