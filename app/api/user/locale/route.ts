import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const SUPPORTED = ['en','es','pt','fr','de','it','zh','ja','hi','ko'];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { locale } = await req.json() as { locale: string };
  if (!SUPPORTED.includes(locale)) {
    return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 });
  }

  await supabase.from('users').update({ preferred_language: locale }).eq('id', user.id);
  return NextResponse.json({ ok: true });
}
