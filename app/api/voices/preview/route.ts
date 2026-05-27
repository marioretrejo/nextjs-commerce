import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  // Only allow ElevenLabs CDN URLs
  if (!url.startsWith('https://storage.googleapis.com/eleven-') &&
      !url.startsWith('https://api.elevenlabs.io/') &&
      !url.startsWith('https://elevenlabs.io/')) {
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
