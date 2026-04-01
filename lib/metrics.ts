import { prisma } from './db';
import { startOfMonth, endOfMonth, startOfWeek, addDays, format } from 'date-fns';

export type PeriodType = 'weekly' | 'monthly';

export interface PeriodRange {
  start: Date;
  end: Date;
}

export interface MetricsResult {
  campaignBase: string;
  country: string;
  periodType: PeriodType;
  periodStart: Date;
  periodEnd: Date;
  totalLeads: number;
  totalFtds: number;
  conversionRate: number | null; // null = no leads loaded yet
  reached2Percent: boolean;
  pendingLeads: boolean; // true when FTDs exist but no leads yet
}

/**
 * Get the current weekly range: Monday → Saturday
 */
export function getCurrentWeekRange(today: Date = new Date()): PeriodRange {
  // startOfWeek with weekStartsOn:1 gives this Monday
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const saturday = addDays(monday, 5); // Monday + 5 = Saturday
  const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 0, 0, 0);
  const end = new Date(saturday.getFullYear(), saturday.getMonth(), saturday.getDate(), 23, 59, 59);
  return { start, end };
}

/**
 * Get the current monthly range: 1st → last day of month
 */
export function getCurrentMonthRange(today: Date = new Date()): PeriodRange {
  const start = startOfMonth(today);
  const end = endOfMonth(today);
  return { start, end };
}

/**
 * Calculate metrics for a specific campaign+country combination for a period.
 */
export async function calculateMetrics(
  campaignBase: string,
  country: string,
  periodType: PeriodType,
  today: Date = new Date()
): Promise<MetricsResult> {
  const range =
    periodType === 'weekly'
      ? getCurrentWeekRange(today)
      : getCurrentMonthRange(today);

  // Count FTDs in this period
  const ftdCount = await prisma.ftd.count({
    where: {
      campaignBase,
      country,
      registrationDate: {
        gte: range.start,
        lte: range.end
      }
    }
  });

  // Sum leads in this period
  const leadsAgg = await prisma.dailyLead.aggregate({
    where: {
      campaignBase,
      country,
      date: {
        gte: range.start,
        lte: range.end
      }
    },
    _sum: { leads: true }
  });
  const totalLeads = leadsAgg._sum.leads ?? 0;

  let conversionRate: number | null = null;
  let reached2Percent = false;
  const pendingLeads = ftdCount > 0 && totalLeads === 0;

  if (totalLeads > 0) {
    conversionRate = (ftdCount / totalLeads) * 100;
    reached2Percent = conversionRate >= 2;
  }

  return {
    campaignBase,
    country,
    periodType,
    periodStart: range.start,
    periodEnd: range.end,
    totalLeads,
    totalFtds: ftdCount,
    conversionRate,
    reached2Percent,
    pendingLeads
  };
}

/**
 * Calculate and persist metrics for a campaign+country (both periods).
 * Also creates alerts when 2% threshold is reached.
 */
export async function recalculateAndPersist(
  campaignBase: string,
  country: string,
  today: Date = new Date()
): Promise<{ weekly: MetricsResult; monthly: MetricsResult }> {
  const settings = await getSettings();

  const weekly = await calculateMetrics(campaignBase, country, 'weekly', today);
  const monthly = await calculateMetrics(campaignBase, country, 'monthly', today);

  // Persist weekly metric
  await upsertMetric(weekly, settings);
  // Persist monthly metric
  await upsertMetric(monthly, settings);

  // Handle alerts
  await checkAndCreateAlerts(weekly, monthly, settings);

  return { weekly, monthly };
}

async function upsertMetric(
  m: MetricsResult,
  settings: AppSettings
): Promise<void> {
  const { triggerStatus, triggerReason } = evaluateTrigger(m, settings);
  const crmRecommendation = evaluateCrmAction(m, settings);
  const minLeads =
    m.periodType === 'weekly'
      ? settings.weeklyMinLeadsForTop
      : settings.monthlyMinLeadsForTop;

  await prisma.campaignMetric.upsert({
    where: {
      campaignBase_country_periodType_periodStart: {
        campaignBase: m.campaignBase,
        country: m.country,
        periodType: m.periodType,
        periodStart: m.periodStart
      }
    },
    update: {
      totalLeads: m.totalLeads,
      totalFtds: m.totalFtds,
      conversionRate: m.conversionRate ?? 0,
      reached2Percent: m.reached2Percent,
      qualifiedForTop: m.totalLeads >= minLeads,
      triggerStatus,
      triggerReason,
      crmRecommendation,
      periodEnd: m.periodEnd
    },
    create: {
      campaignBase: m.campaignBase,
      country: m.country,
      periodType: m.periodType,
      periodStart: m.periodStart,
      periodEnd: m.periodEnd,
      totalLeads: m.totalLeads,
      totalFtds: m.totalFtds,
      conversionRate: m.conversionRate ?? 0,
      reached2Percent: m.reached2Percent,
      qualifiedForTop: m.totalLeads >= minLeads,
      triggerStatus,
      triggerReason,
      crmRecommendation
    }
  });
}

async function checkAndCreateAlerts(
  weekly: MetricsResult,
  monthly: MetricsResult,
  settings: AppSettings
): Promise<void> {
  const threshold = settings.weeklyThresholdPercent;

  if (weekly.reached2Percent && (weekly.conversionRate ?? 0) >= threshold) {
    await prisma.alert.create({
      data: {
        campaignBase: weekly.campaignBase,
        country: weekly.country,
        alertType: 'weekly_2_percent',
        conversionRate: weekly.conversionRate!,
        details: `Semana: ${weekly.totalFtds} FTD / ${weekly.totalLeads} leads = ${weekly.conversionRate!.toFixed(2)}%`
      }
    });
  }

  if (monthly.reached2Percent && (monthly.conversionRate ?? 0) >= settings.monthlyThresholdPercent) {
    await prisma.alert.create({
      data: {
        campaignBase: monthly.campaignBase,
        country: monthly.country,
        alertType: 'monthly_2_percent',
        conversionRate: monthly.conversionRate!,
        details: `Mes: ${monthly.totalFtds} FTD / ${monthly.totalLeads} leads = ${monthly.conversionRate!.toFixed(2)}%`
      }
    });
  }
}

export function evaluateTrigger(
  m: MetricsResult,
  settings: AppSettings
): { triggerStatus: string; triggerReason: string } {
  const minLeads =
    m.periodType === 'weekly'
      ? settings.weeklyMinLeadsForTrigger
      : settings.monthlyMinLeadsForTrigger;
  const threshold =
    m.periodType === 'weekly'
      ? settings.weeklyThresholdPercent
      : settings.monthlyThresholdPercent;

  if (m.pendingLeads || m.conversionRate === null) {
    return {
      triggerStatus: 'do_not_fire',
      triggerReason: 'Pending leads, cannot evaluate'
    };
  }

  const hasVolume = m.totalLeads >= minLeads;
  const hitThreshold = (m.conversionRate ?? 0) >= threshold;
  const nearThreshold = (m.conversionRate ?? 0) >= threshold * 0.75 && !hitThreshold;

  if (hitThreshold && hasVolume) {
    return {
      triggerStatus: 'fire_now',
      triggerReason: `Reached ${threshold}% ${m.periodType} with sufficient volume`
    };
  }

  if (hitThreshold && !hasVolume) {
    return {
      triggerStatus: 'watch',
      triggerReason: `Reached ${threshold}% ${m.periodType} but low volume (${m.totalLeads}/${minLeads} leads)`
    };
  }

  if (nearThreshold && hasVolume) {
    return {
      triggerStatus: 'watch',
      triggerReason: `Near threshold: ${m.conversionRate!.toFixed(2)}% ${m.periodType}`
    };
  }

  return {
    triggerStatus: 'do_not_fire',
    triggerReason: `Below threshold: ${m.conversionRate!.toFixed(2)}% ${m.periodType}`
  };
}

export function evaluateCrmAction(m: MetricsResult, settings: AppSettings): string {
  if (m.conversionRate === null || m.pendingLeads) return 'monitor';
  const threshold =
    m.periodType === 'weekly'
      ? settings.weeklyThresholdPercent
      : settings.monthlyThresholdPercent;

  if ((m.conversionRate ?? 0) >= threshold && m.totalLeads >= (m.periodType === 'weekly' ? settings.weeklyMinLeadsForTop : settings.monthlyMinLeadsForTop)) {
    return 'duplicate';
  }
  if ((m.conversionRate ?? 0) < threshold * 0.5) {
    return 'hide';
  }
  return 'monitor';
}

export interface AppSettings {
  weeklyThresholdPercent: number;
  monthlyThresholdPercent: number;
  weeklyMinLeadsForTop: number;
  monthlyMinLeadsForTop: number;
  weeklyMinLeadsForTrigger: number;
  monthlyMinLeadsForTrigger: number;
  weekStartDay: number;
  weekEndDay: number;
}

export async function getSettings(): Promise<AppSettings> {
  let s = await prisma.appSetting.findFirst();
  if (!s) {
    s = await prisma.appSetting.create({
      data: {}
    });
  }
  return {
    weeklyThresholdPercent: s.weeklyThresholdPercent,
    monthlyThresholdPercent: s.monthlyThresholdPercent,
    weeklyMinLeadsForTop: s.weeklyMinLeadsForTop,
    monthlyMinLeadsForTop: s.monthlyMinLeadsForTop,
    weeklyMinLeadsForTrigger: s.weeklyMinLeadsForTrigger,
    monthlyMinLeadsForTrigger: s.monthlyMinLeadsForTrigger,
    weekStartDay: s.weekStartDay,
    weekEndDay: s.weekEndDay
  };
}
