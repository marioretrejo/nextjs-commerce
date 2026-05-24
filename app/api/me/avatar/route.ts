import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const ext = file.name.split('.').pop() ?? 'png';
  const path = `avatars/${user.id}.${ext}`;
  const bytes = await file.arrayBuffer();

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from('avatars')
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = admin.storage.from('avatars').getPublicUrl(path);
  const avatar_url = urlData.publicUrl;

  await admin.from('users').update({ avatar_url }).eq('id', user.id);
  return NextResponse.json({ avatar_url });
}
