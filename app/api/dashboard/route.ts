export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from 'lib/db';
import { getSessionFromRequest } from 'lib/auth';
import { getCurrentWeekRange, getCurrentMonthRange } from 'lib/metrics';
import { addDays } from 'date-fns';

// GET /api/dashboard  → aggregated stats for main dashboard including trends
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  const weekRange = getCurrentWeekRange(today);
  const monthRange = getCurrentMonthRange(today);

  // Previous week range (7 days back)
  const prevWeekStart = addDays(weekRange.start, -7);
  const prevWeekEnd = addDays(weekRange.end, -7);

  // Previous month range
  const prevMonthEnd = new Date(monthRange.start.getTime() - 1);
  const prevMonthStart = new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 1);

  const [
    todayFtdCount,
    todayLeadsSum,
    weeklyFtdCount,
    monthlyFtdCount,
    prevWeeklyFtdCount,
    prevMonthlyFtdCount,
    activeAlerts,
    fireNowCount,
    topWeekly,
    recentFtds,
    weeklyLeads,
    monthlyLeads,
    prevWeeklyLeads,
    prevMonthlyLeads
  ] = await Promise.all([
    prisma.ftd.count({ where: { registrationDate: { gte: todayStart, lte: todayEnd } } }),
    prisma.dailyLead.aggregate({ where: { date: { gte: todayStart, lte: todayEnd } }, _sum: { leads: true } }),
    prisma.ftd.count({ where: { registrationDate: { gte: weekRange.start, lte: weekRange.end } } }),
    prisma.ftd.count({ where: { registrationDate: { gte: monthRange.start, lte: monthRange.end } } }),
    prisma.ftd.count({ where: { registrationDate: { gte: prevWeekStart, lte: prevWeekEnd } } }),
    prisma.ftd.count({ where: { registrationDate: { gte: prevMonthStart, lte: prevMonthEnd } } }),
    prisma.alert.count({ where: { status: 'active' } }),
    prisma.campaignMetric.count({ where: { triggerStatus: 'fire_now', periodType: 'weekly', periodStart: weekRange.start } }),
    prisma.campaignMetric.findMany({
      where: { periodType: 'weekly', periodStart: weekRange.start, qualifiedForTop: true, totalFtds: { gt: 0 } },
      orderBy: [{ conversionRate: 'desc' }, { totalFtds: 'desc' }],
      take: 3
    }),
    prisma.ftd.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.dailyLead.aggregate({ where: { date: { gte: weekRange.start, lte: weekRange.end } }, _sum: { leads: true } }),
    prisma.dailyLead.aggregate({ where: { date: { gte: monthRange.start, lte: monthRange.end } }, _sum: { leads: true } }),
    prisma.dailyLead.aggregate({ where: { date: { gte: prevWeekStart, lte: prevWeekEnd } }, _sum: { leads: true } }),
    prisma.dailyLead.aggregate({ where: { date: { gte: prevMonthStart, lte: prevMonthEnd } }, _sum: { leads: true } })
  ]);

  const weeklyLeadTotal = weeklyLeads._sum.leads ?? 0;
  const monthlyLeadTotal = monthlyLeads._sum.leads ?? 0;
  const prevWeeklyLeadTotal = prevWeeklyLeads._sum.leads ?? 0;
  const prevMonthlyLeadTotal = prevMonthlyLeads._sum.leads ?? 0;

  const weeklyConversion = weeklyLeadTotal > 0 ? (weeklyFtdCount / weeklyLeadTotal) * 100 : null;
  const monthlyConversion = monthlyLeadTotal > 0 ? (monthlyFtdCount / monthlyLeadTotal) * 100 : null;
  const prevWeeklyConversion = prevWeeklyLeadTotal > 0 ? (prevWeeklyFtdCount / prevWeeklyLeadTotal) * 100 : null;
  const prevMonthlyConversion = prevMonthlyLeadTotal > 0 ? (prevMonthlyFtdCount / prevMonthlyLeadTotal) * 100 : null;

  function calcTrend(current: number | null, previous: number | null) {
    if (current === null || previous === null) return { direction: 'new' as const, deltaAbsolute: null, deltaPercent: null };
    const deltaAbsolute = current - previous;
    const deltaPercent = previous > 0 ? (deltaAbsolute / previous) * 100 : null;
    const direction = deltaPercent !== null && deltaPercent > 5 ? 'up' as const
      : deltaPercent !== null && deltaPercent < -5 ? 'down' as const
      : 'stable' as const;
    return { direction, deltaAbsolute, deltaPercent };
  }

  return NextResponse.json({
    today: {
      ftds: todayFtdCount,
      leads: todayLeadsSum._sum.leads ?? 0
    },
    weekly: {
      ftds: weeklyFtdCount,
      leads: weeklyLeadTotal,
      conversion: weeklyConversion,
      prevConversion: prevWeeklyConversion,
      trend: calcTrend(weeklyConversion, prevWeeklyConversion),
      range: { start: weekRange.start, end: weekRange.end }
    },
    monthly: {
      ftds: monthlyFtdCount,
      leads: monthlyLeadTotal,
      conversion: monthlyConversion,
      prevConversion: prevMonthlyConversion,
      trend: calcTrend(monthlyConversion, prevMonthlyConversion),
      range: { start: monthRange.start, end: monthRange.end }
    },
    activeAlerts,
    fireNowCount,
    topWeekly,
    recentFtds
  });
}
