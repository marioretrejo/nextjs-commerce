import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const supabaseCookies = allCookies
    .filter(c => c.name.startsWith('sb-'))
    .map(c => ({ name: c.name, length: c.value.length }));

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  return NextResponse.json({
    serverSeesSession: !!user,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    error: error?.message ?? null,
    supabaseCookieCount: supabaseCookies.length,
    supabaseCookies,
    totalCookies: allCookies.length,
  });
}
