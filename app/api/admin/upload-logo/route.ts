/**
 * POST /api/admin/upload-logo
 * Uploads a logo image to Supabase Storage (workspace-logos bucket).
 * Superadmin only. Returns the public URL.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const { data: p } = await supabase.from('users').select('is_superadmin').eq('id', user.id).single();
  if (!(p as { is_superadmin: boolean } | null)?.is_superadmin) {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, error: null };
}

export async function POST(req: Request) {
  const { user, error } = await requireSuperadmin();
  if (!user || error) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  const ALLOWED = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Only SVG, PNG, JPG or WebP allowed' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() ?? 'png';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const admin = createAdminClient();
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const { error: uploadErr } = await admin.storage
    .from('workspace-logos')
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    console.error('upload-logo error:', uploadErr);
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage
    .from('workspace-logos')
    .getPublicUrl(filename);

  return NextResponse.json({ url: publicUrl });
}
