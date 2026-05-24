import { elevenlabs } from '@/lib/elevenlabs/client';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const name = formData.get('name') as string;
  const description = formData.get('description') as string | null;
  const files = formData.getAll('files') as File[];

  if (!name || files.length === 0) {
    return NextResponse.json({ error: 'name and files required' }, { status: 400 });
  }

  const fd = new FormData();
  fd.append('name', name);
  if (description) fd.append('description', description);
  files.forEach((f) => fd.append('files', f));

  try {
    const result = await elevenlabs.cloneVoice(fd);
    return NextResponse.json({ voice_id: result.voice_id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
