import { prisma } from './db';
import { getCurrentWeekRange, getCurrentMonthRange } from './metrics';

export type TrendDirection = 'up' | 'down' | 'stable' | 'new';

export interface PeriodMetricSummary {
  periodStart: Date;
  periodEnd: Date;
  totalLeads: number;
  totalFtds: number;
  conversionRate: number;
  reached2Percent: boolean;
  triggerStatus: string;
  crmRecommendation: string | null;
  topRank: number | null;
}

export interface TrendResult {
  direction: TrendDirection;
  currentRate: number | null;
  previousRate: number | null;
  deltaPercent: number | null;
  deltaAbsolute: number | null;
}

export interface CampaignTrend {
  weekly: TrendResult;
  monthly: TrendResult;
}

export interface CampaignProfile {
  campaignBase: string;
  country: string;
  weeklyHistory: PeriodMetricSummary[];
  monthlyHistory: PeriodMetricSummary[];
  recentFtds: {
    id: number;
    registrationDate: Date;
    customerName: string;
    amount: number;
    rawCampaignName: string;
    isDelayedFtd: boolean;
    isSameDay: boolean;
    providerSource: string;
  }[];
  crmActions: {
    id: number;
    actionType: string;
    reason: string | null;
    status: string;
    executedAt: Date | null;
    createdAt: Date;
  }[];
  activeAlerts: {
    id: number;
    alertType: string;
    conversionRate: number;
    triggeredAt: Date;
    details: string | null;
  }[];
  rankHistory: {
    periodStart: Date;
    periodType: string;
    rank: number;
    conversionRate: number;
  }[];
  trend: CampaignTrend;
}

/**
 * Returns last N period metric records for a campaign+country.
 * Leverages the existing CampaignMetric table which stores one row per period
 * (each week/month gets its own periodStart key, so history is already there).
 */
export async function getHistoricalMetrics(
  campaignBase: string,
  country: string,
  periodType: 'weekly' | 'monthly',
  lastN = 8
): Promise<PeriodMetricSummary[]> {
  const rows = await prisma.campaignMetric.findMany({
    where: { campaignBase, country, periodType },
    orderBy: { periodStart: 'desc' },
    take: lastN
  });

  return rows.map((r) => ({
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    totalLeads: r.totalLeads,
    totalFtds: r.totalFtds,
    conversionRate: r.conversionRate,
    reached2Percent: r.reached2Percent,
    triggerStatus: r.triggerStatus,
    crmRecommendation: r.crmRecommendation,
    topRank: r.topRank
  }));
}

/**
 * Computes trend for one period type by comparing current vs previous period.
 */
async function computeTrend(
  campaignBase: string,
  country: string,
  periodType: 'weekly' | 'monthly',
  today: Date
): Promise<TrendResult> {
  const currentRange =
    periodType === 'weekly' ? getCurrentWeekRange(today) : getCurrentMonthRange(today);

  // Grab the two most recent metric rows for this campaign+country+periodType
  const rows = await prisma.campaignMetric.findMany({
    where: { campaignBase, country, periodType },
    orderBy: { periodStart: 'desc' },
    take: 2
  });

  const current = rows.find(
    (r) => r.periodStart.getTime() === currentRange.start.getTime()
  ) ?? rows[0];

  const previous = rows.find(
    (r) => r.periodStart.getTime() !== (current?.periodStart.getTime() ?? 0)
  );

  if (!current || current.totalLeads === 0) {
    return { direction: 'new', currentRate: null, previousRate: null, deltaPercent: null, deltaAbsolute: null };
  }

  const currentRate = current.conversionRate;

  if (!previous || previous.totalLeads === 0) {
    return { direction: 'new', currentRate, previousRate: null, deltaPercent: null, deltaAbsolute: null };
  }

  const previousRate = previous.conversionRate;
  const deltaAbsolute = currentRate - previousRate;
  const deltaPercent = previousRate > 0 ? (deltaAbsolute / previousRate) * 100 : null;

  let direction: TrendDirection = 'stable';
  if (deltaPercent !== null) {
    if (deltaPercent > 5) direction = 'up';
    else if (deltaPercent < -5) direction = 'down';
  }

  return { direction, currentRate, previousRate, deltaPercent, deltaAbsolute };
}

/**
 * Full trend analysis for both weekly and monthly periods.
 */
export async function getTrendAnalysis(
  campaignBase: string,
  country: string,
  today: Date = new Date()
): Promise<CampaignTrend> {
  const [weekly, monthly] = await Promise.all([
    computeTrend(campaignBase, country, 'weekly', today),
    computeTrend(campaignBase, country, 'monthly', today)
  ]);
  return { weekly, monthly };
}

/**
 * Full campaign profile: all history, FTDs, CRM actions, alerts, rank history, trend.
 */
export async function getCampaignProfile(
  campaignBase: string,
  country: string,
  today: Date = new Date()
): Promise<CampaignProfile> {
  const [weeklyHistory, monthlyHistory, recentFtds, crmActions, activeAlerts, rankHistory, trend] =
    await Promise.all([
      getHistoricalMetrics(campaignBase, country, 'weekly', 8),
      getHistoricalMetrics(campaignBase, country, 'monthly', 6),
      prisma.ftd.findMany({
        where: { campaignBase, country },
        orderBy: { registrationDate: 'desc' },
        take: 20,
        select: {
          id: true,
          registrationDate: true,
          customerName: true,
          amount: true,
          rawCampaignName: true,
          isDelayedFtd: true,
          isSameDay: true,
          providerSource: true
        }
      }),
      prisma.crmAction.findMany({
        where: { campaignBase, country },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      prisma.alert.findMany({
        where: { campaignBase, country, status: 'active' },
        orderBy: { triggeredAt: 'desc' }
      }),
      prisma.rankSnapshot.findMany({
        where: { campaignBase, country },
        orderBy: { periodStart: 'desc' },
        take: 12
      }),
      getTrendAnalysis(campaignBase, country, today)
    ]);

  return {
    campaignBase,
    country,
    weeklyHistory,
    monthlyHistory,
    recentFtds,
    crmActions,
    activeAlerts,
    rankHistory: rankHistory.map((r) => ({
      periodStart: r.periodStart,
      periodType: r.periodType,
      rank: r.rank,
      conversionRate: r.conversionRate
    })),
    trend
  };
}

/**
 * Get all unique campaign+country pairs that have any data (FTDs or leads).
 */
export async function getAllActiveCampaigns(): Promise<
  { campaignBase: string; country: string; lastActivity: Date | null }[]
> {
  const [ftdGroups, leadGroups] = await Promise.all([
    prisma.ftd.groupBy({
      by: ['campaignBase', 'country'],
      _max: { registrationDate: true }
    }),
    prisma.dailyLead.groupBy({
      by: ['campaignBase', 'country'],
      _max: { date: true }
    })
  ]);

  const map = new Map<string, { campaignBase: string; country: string; lastActivity: Date | null }>();

  for (const g of ftdGroups) {
    const key = `${g.campaignBase}|${g.country}`;
    map.set(key, {
      campaignBase: g.campaignBase,
      country: g.country,
      lastActivity: g._max.registrationDate
    });
  }

  for (const g of leadGroups) {
    const key = `${g.campaignBase}|${g.country}`;
    const existing = map.get(key);
    const date = g._max.date;
    if (!existing) {
      map.set(key, { campaignBase: g.campaignBase, country: g.country, lastActivity: date });
    } else if (date && (!existing.lastActivity || date > existing.lastActivity)) {
      existing.lastActivity = date;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (!a.lastActivity) return 1;
    if (!b.lastActivity) return -1;
    return b.lastActivity.getTime() - a.lastActivity.getTime();
  });
}
