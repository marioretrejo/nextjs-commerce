export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from 'lib/auth';
import { getAllActiveCampaigns } from 'lib/memory';
import { getCurrentWeekRange } from 'lib/metrics';
import { prisma } from 'lib/db';

// GET /api/campaigns  → all campaign+country pairs with current-period summary
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const campaigns = await getAllActiveCampaigns();
  const weekRange = getCurrentWeekRange();

  // Fetch current weekly metric for each campaign
  const metrics = await prisma.campaignMetric.findMany({
    where: {
      periodType: 'weekly',
      periodStart: weekRange.start
    }
  });

  const metricMap = new Map(
    metrics.map((m) => [`${m.campaignBase}|${m.country}`, m])
  );

  const result = campaigns.map((c) => {
    const m = metricMap.get(`${c.campaignBase}|${c.country}`);
    return {
      campaignBase: c.campaignBase,
      country: c.country,
      lastActivity: c.lastActivity,
      weeklyConversion: m?.conversionRate ?? null,
      weeklyFtds: m?.totalFtds ?? 0,
      weeklyLeads: m?.totalLeads ?? 0,
      triggerStatus: m?.triggerStatus ?? 'do_not_fire',
      crmRecommendation: m?.crmRecommendation ?? null,
      reached2Percent: m?.reached2Percent ?? false
    };
  });

  return NextResponse.json({ campaigns: result });
}
