import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'lib/db';
import { getSessionFromRequest } from 'lib/auth';
import { getCurrentWeekRange, getCurrentMonthRange } from 'lib/metrics';

// GET /api/dashboard  → aggregated stats for main dashboard
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  const weekRange = getCurrentWeekRange(today);
  const monthRange = getCurrentMonthRange(today);

  const [
    todayFtdCount,
    todayLeadsSum,
    weeklyFtdCount,
    monthlyFtdCount,
    activeAlerts,
    fireNowCount,
    topWeekly,
    recentFtds
  ] = await Promise.all([
    // FTDs today
    prisma.ftd.count({
      where: { registrationDate: { gte: todayStart, lte: todayEnd } }
    }),
    // Leads today
    prisma.dailyLead.aggregate({
      where: { date: { gte: todayStart, lte: todayEnd } },
      _sum: { leads: true }
    }),
    // FTDs this week
    prisma.ftd.count({
      where: { registrationDate: { gte: weekRange.start, lte: weekRange.end } }
    }),
    // FTDs this month
    prisma.ftd.count({
      where: { registrationDate: { gte: monthRange.start, lte: monthRange.end } }
    }),
    // Active alerts
    prisma.alert.count({ where: { status: 'active' } }),
    // Campaigns ready to fire
    prisma.campaignMetric.count({
      where: {
        triggerStatus: 'fire_now',
        periodType: 'weekly',
        periodStart: weekRange.start
      }
    }),
    // Top 3 weekly campaigns
    prisma.campaignMetric.findMany({
      where: {
        periodType: 'weekly',
        periodStart: weekRange.start,
        qualifiedForTop: true,
        totalFtds: { gt: 0 }
      },
      orderBy: [{ conversionRate: 'desc' }, { totalFtds: 'desc' }],
      take: 3
    }),
    // 5 most recent FTDs
    prisma.ftd.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5
    })
  ]);

  // Global weekly conversion
  const weeklyLeads = await prisma.dailyLead.aggregate({
    where: { date: { gte: weekRange.start, lte: weekRange.end } },
    _sum: { leads: true }
  });
  const weeklyLeadTotal = weeklyLeads._sum.leads ?? 0;
  const weeklyConversion =
    weeklyLeadTotal > 0 ? (weeklyFtdCount / weeklyLeadTotal) * 100 : null;

  const monthlyLeads = await prisma.dailyLead.aggregate({
    where: { date: { gte: monthRange.start, lte: monthRange.end } },
    _sum: { leads: true }
  });
  const monthlyLeadTotal = monthlyLeads._sum.leads ?? 0;
  const monthlyConversion =
    monthlyLeadTotal > 0 ? (monthlyFtdCount / monthlyLeadTotal) * 100 : null;

  return NextResponse.json({
    today: {
      ftds: todayFtdCount,
      leads: todayLeadsSum._sum.leads ?? 0
    },
    weekly: {
      ftds: weeklyFtdCount,
      leads: weeklyLeadTotal,
      conversion: weeklyConversion,
      range: { start: weekRange.start, end: weekRange.end }
    },
    monthly: {
      ftds: monthlyFtdCount,
      leads: monthlyLeadTotal,
      conversion: monthlyConversion,
      range: { start: monthRange.start, end: monthRange.end }
    },
    activeAlerts,
    fireNowCount,
    topWeekly,
    recentFtds
  });
}
