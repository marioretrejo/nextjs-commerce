export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from 'lib/auth';
import { getCampaignProfile } from 'lib/memory';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ base: string; country: string }> }
) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { base, country } = await params;
  const campaignBase = decodeURIComponent(base);
  const countryDecoded = decodeURIComponent(country);

  const profile = await getCampaignProfile(campaignBase, countryDecoded);
  return NextResponse.json({ profile });
}
