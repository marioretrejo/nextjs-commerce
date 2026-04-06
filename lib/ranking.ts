import { prisma } from './db';
import { AppSettings, getCurrentWeekRange, getCurrentMonthRange } from './metrics';

export interface RankedCampaign {
  rank: number;
  rankChange: number | null; // positive = moved up, negative = moved down, null = new
  campaignBase: string;
  country: string;
  conversionRate: number;
  totalFtds: number;
  totalLeads: number;
  periodType: 'weekly' | 'monthly';
  triggerStatus: string;
  crmRecommendation: string | null;
  score: number;
  lastFtdAt: Date | null;
}

/**
 * Build a ranked list of campaign+country combinations.
 * Applies minimum volume filter to avoid false positives.
 *
 * Ranking score (0-100):
 *   - Conversion rate component (50%): (conversionRate / maxConvRate) × 50
 *   - FTD volume component (30%):      min(totalFtds / 10, 1) × 30
 *   - Recency component (20%):         recencyFactor × 20
 */
export async function buildTopRanking(
  periodType: 'weekly' | 'monthly',
  settings: AppSettings,
  today: Date = new Date()
): Promise<RankedCampaign[]> {
  const range =
    periodType === 'weekly'
      ? getCurrentWeekRange(today)
      : getCurrentMonthRange(today);

  const minLeads =
    periodType === 'weekly'
      ? settings.weeklyMinLeadsForTop
      : settings.monthlyMinLeadsForTop;

  // Get all metrics with sufficient volume
  const metrics = await prisma.campaignMetric.findMany({
    where: {
      periodType,
      periodStart: range.start,
      totalLeads: { gte: minLeads },
      totalFtds: { gt: 0 }
    },
    orderBy: [{ conversionRate: 'desc' }, { totalFtds: 'desc' }]
  });

  if (metrics.length === 0) return [];

  // Get recent FTD dates for recency factor
  const campaignKeys = metrics.map((m) => ({
    campaignBase: m.campaignBase,
    country: m.country
  }));

  const recentFtds = await Promise.all(
    campaignKeys.map((k) =>
      prisma.ftd.findFirst({
        where: {
          campaignBase: k.campaignBase,
          country: k.country,
          registrationDate: { gte: range.start, lte: range.end }
        },
        orderBy: { registrationDate: 'desc' },
        select: { registrationDate: true }
      })
    )
  );

  // Fetch previous period rank snapshots for rank-change calculation
  const prevSnapshots = await prisma.rankSnapshot.findMany({
    where: {
      periodType,
      campaignBase: { in: metrics.map((m) => m.campaignBase) }
    },
    orderBy: { periodStart: 'desc' }
  });
  // Build map: "campaignBase|country" -> previous rank (excluding current period)
  const prevRankMap = new Map<string, number>();
  for (const snap of prevSnapshots) {
    if (snap.periodStart.getTime() === range.start.getTime()) continue;
    const key = `${snap.campaignBase}|${snap.country}`;
    if (!prevRankMap.has(key)) prevRankMap.set(key, snap.rank);
  }

  const maxConvRate = Math.max(...metrics.map((m) => m.conversionRate), 0.01);
  const now = today.getTime();
  const ONE_DAY = 86400000;

  const scored: RankedCampaign[] = metrics.map((m, i) => {
    const lastFtdAt = recentFtds[i]?.registrationDate ?? null;
    let recencyFactor = 0.1;
    if (lastFtdAt) {
      const diffDays = (now - lastFtdAt.getTime()) / ONE_DAY;
      if (diffDays <= 1) recencyFactor = 1.0;
      else if (diffDays <= 2) recencyFactor = 0.7;
      else if (diffDays <= 7) recencyFactor = 0.5;
      else recencyFactor = 0.2;
    }

    const convComponent = (m.conversionRate / maxConvRate) * 50;
    const ftdComponent = Math.min(m.totalFtds / 10, 1) * 30;
    const recencyComponent = recencyFactor * 20;
    const score = convComponent + ftdComponent + recencyComponent;

    const prevRank = prevRankMap.get(`${m.campaignBase}|${m.country}`) ?? null;

    return {
      rank: 0, // filled below
      rankChange: null, // filled after sort
      campaignBase: m.campaignBase,
      country: m.country,
      conversionRate: m.conversionRate,
      totalFtds: m.totalFtds,
      totalLeads: m.totalLeads,
      periodType,
      triggerStatus: m.triggerStatus,
      crmRecommendation: m.crmRecommendation,
      score,
      lastFtdAt,
      _prevRank: prevRank
    } as RankedCampaign & { _prevRank: number | null };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Assign ranks and calculate rank change
  scored.forEach((c, i) => {
    c.rank = i + 1;
    const prev = (c as RankedCampaign & { _prevRank?: number | null })._prevRank;
    c.rankChange = prev != null ? prev - c.rank : null; // positive = improved
  });

  // Update ranks in CampaignMetric and persist to RankSnapshot (history)
  await Promise.all(
    scored.map((c) =>
      Promise.all([
        prisma.campaignMetric.updateMany({
          where: {
            campaignBase: c.campaignBase,
            country: c.country,
            periodType,
            periodStart: range.start
          },
          data: { topRank: c.rank }
        }),
        prisma.rankSnapshot.upsert({
          where: {
            campaignBase_country_periodType_periodStart: {
              campaignBase: c.campaignBase,
              country: c.country,
              periodType,
              periodStart: range.start
            }
          },
          update: {
            rank: c.rank,
            conversionRate: c.conversionRate,
            totalFtds: c.totalFtds,
            totalLeads: c.totalLeads
          },
          create: {
            campaignBase: c.campaignBase,
            country: c.country,
            periodType,
            periodStart: range.start,
            rank: c.rank,
            conversionRate: c.conversionRate,
            totalFtds: c.totalFtds,
            totalLeads: c.totalLeads
          }
        })
      ])
    )
  );

  return scored;
}

/**
 * Get the current rank of a specific campaign+country.
 */
export async function getCampaignRank(
  campaignBase: string,
  country: string,
  periodType: 'weekly' | 'monthly',
  settings: AppSettings,
  today: Date = new Date()
): Promise<number | null> {
  const ranking = await buildTopRanking(periodType, settings, today);
  const entry = ranking.find(
    (r) =>
      r.campaignBase.toLowerCase() === campaignBase.toLowerCase() &&
      r.country.toLowerCase() === country.toLowerCase()
  );
  return entry?.rank ?? null;
}
