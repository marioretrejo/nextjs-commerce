import { MetricsResult, AppSettings } from './metrics';

export type TriggerStatus = 'fire_now' | 'watch' | 'do_not_fire';

export interface TriggerEvaluation {
  status: TriggerStatus;
  label: string;
  color: string;
  reasons: string[];
  weeklyConversion: number | null;
  monthlyConversion: number | null;
  weeklyLeads: number;
  monthlyLeads: number;
  weeklyFtds: number;
  monthlyFtds: number;
  isDelayed: boolean;
  isSameDay: boolean;
  crmRecommendation: 'duplicate' | 'hide' | 'monitor';
  crmReason: string;
  topRankEstimate?: number;
}

/**
 * Full trigger evaluation combining weekly + monthly metrics.
 * Called after parsing and saving a new FTD.
 */
export function evaluateFullTrigger(
  weekly: MetricsResult,
  monthly: MetricsResult,
  isDelayedFtd: boolean,
  isSameDayFtd: boolean,
  settings: AppSettings
): TriggerEvaluation {
  const reasons: string[] = [];

  const weeklyConv = weekly.conversionRate;
  const monthlyConv = monthly.conversionRate;
  const weeklyThreshold = settings.weeklyThresholdPercent;
  const monthlyThreshold = settings.monthlyThresholdPercent;
  const weeklyMinLeads = settings.weeklyMinLeadsForTrigger;
  const monthlyMinLeads = settings.monthlyMinLeadsForTrigger;

  // ── CASE 1: Same-day FTD → never trigger fire_now
  if (isSameDayFtd && !isDelayedFtd) {
    reasons.push('FTD del día – no activa lógica de disparo');
    return {
      status: 'do_not_fire',
      label: 'NO DISPARAR TODAVÍA',
      color: 'red',
      reasons,
      weeklyConversion: weeklyConv,
      monthlyConversion: monthlyConv,
      weeklyLeads: weekly.totalLeads,
      monthlyLeads: monthly.totalLeads,
      weeklyFtds: weekly.totalFtds,
      monthlyFtds: monthly.totalFtds,
      isDelayed: isDelayedFtd,
      isSameDay: isSameDayFtd,
      crmRecommendation: 'monitor',
      crmReason: 'FTD del día, no se puede evaluar aún'
    };
  }

  // ── CASE 2: Pending leads (no conversion calculable)
  if (weekly.pendingLeads && monthly.pendingLeads) {
    reasons.push('Leads pendientes de carga – no se puede calcular conversión');
    return {
      status: 'do_not_fire',
      label: 'NO DISPARAR TODAVÍA',
      color: 'gray',
      reasons,
      weeklyConversion: null,
      monthlyConversion: null,
      weeklyLeads: 0,
      monthlyLeads: 0,
      weeklyFtds: weekly.totalFtds,
      monthlyFtds: monthly.totalFtds,
      isDelayed: isDelayedFtd,
      isSameDay: isSameDayFtd,
      crmRecommendation: 'monitor',
      crmReason: 'Sin leads, no evaluable'
    };
  }

  // ── Evaluate each period
  const weeklyOk = weeklyConv !== null && weeklyConv >= weeklyThreshold;
  const monthlyOk = monthlyConv !== null && monthlyConv >= monthlyThreshold;
  const weeklyVolOk = weekly.totalLeads >= weeklyMinLeads;
  const monthlyVolOk = monthly.totalLeads >= monthlyMinLeads;
  const weeklyNear =
    weeklyConv !== null &&
    weeklyConv >= weeklyThreshold * 0.75 &&
    weeklyConv < weeklyThreshold;
  const monthlyNear =
    monthlyConv !== null &&
    monthlyConv >= monthlyThreshold * 0.75 &&
    monthlyConv < monthlyThreshold;

  if (weeklyOk) {
    reasons.push(
      `Alcanzó ${weeklyThreshold}% semanal: ${weeklyConv!.toFixed(2)}% (${weekly.totalFtds} FTD / ${weekly.totalLeads} leads)`
    );
  }
  if (monthlyOk) {
    reasons.push(
      `Alcanzó ${monthlyThreshold}% mensual: ${monthlyConv!.toFixed(2)}% (${monthly.totalFtds} FTD / ${monthly.totalLeads} leads)`
    );
  }
  if (isDelayedFtd) {
    reasons.push('FTD delayed (D_ o fecha anterior) – apto para disparo');
  }
  if (!weeklyVolOk && weekly.totalLeads > 0) {
    reasons.push(`Volumen semanal bajo: ${weekly.totalLeads}/${weeklyMinLeads} mín. leads`);
  }
  if (!monthlyVolOk && monthly.totalLeads > 0) {
    reasons.push(`Volumen mensual bajo: ${monthly.totalLeads}/${monthlyMinLeads} mín. leads`);
  }

  // ── FIRE NOW: at least one period hits threshold + sufficient volume + is delayed
  if (isDelayedFtd && (weeklyOk || monthlyOk) && (weeklyVolOk || monthlyVolOk)) {
    const crmRec = 'duplicate';
    return {
      status: 'fire_now',
      label: 'DISPARAR AHORA',
      color: 'green',
      reasons,
      weeklyConversion: weeklyConv,
      monthlyConversion: monthlyConv,
      weeklyLeads: weekly.totalLeads,
      monthlyLeads: monthly.totalLeads,
      weeklyFtds: weekly.totalFtds,
      monthlyFtds: monthly.totalFtds,
      isDelayed: isDelayedFtd,
      isSameDay: isSameDayFtd,
      crmRecommendation: crmRec,
      crmReason: 'Conversión >= 2% con volumen suficiente y FTD delayed'
    };
  }

  // ── WATCH: threshold hit but low volume, OR near threshold, OR delayed but only partial
  if (
    (weeklyOk || monthlyOk || weeklyNear || monthlyNear) &&
    isDelayedFtd
  ) {
    let crmReason = '';
    if ((weeklyOk || monthlyOk) && !(weeklyVolOk || monthlyVolOk)) {
      crmReason = 'Conversión >= 2% pero volumen bajo';
    } else {
      crmReason = 'Cercano al 2% – monitorear de cerca';
    }
    return {
      status: 'watch',
      label: 'DISPARAR CON PRECAUCIÓN',
      color: 'yellow',
      reasons,
      weeklyConversion: weeklyConv,
      monthlyConversion: monthlyConv,
      weeklyLeads: weekly.totalLeads,
      monthlyLeads: monthly.totalLeads,
      weeklyFtds: weekly.totalFtds,
      monthlyFtds: monthly.totalFtds,
      isDelayed: isDelayedFtd,
      isSameDay: isSameDayFtd,
      crmRecommendation: 'monitor',
      crmReason
    };
  }

  // ── DO NOT FIRE
  reasons.push('No cumple condiciones de disparo');
  return {
    status: 'do_not_fire',
    label: 'NO DISPARAR TODAVÍA',
    color: 'red',
    reasons,
    weeklyConversion: weeklyConv,
    monthlyConversion: monthlyConv,
    weeklyLeads: weekly.totalLeads,
    monthlyLeads: monthly.totalLeads,
    weeklyFtds: weekly.totalFtds,
    monthlyFtds: monthly.totalFtds,
    isDelayed: isDelayedFtd,
    isSameDay: isSameDayFtd,
    crmRecommendation: 'monitor',
    crmReason: 'Conversión insuficiente o condiciones no cumplidas'
  };
}

export function triggerStatusLabel(status: TriggerStatus): string {
  switch (status) {
    case 'fire_now': return 'DISPARAR AHORA';
    case 'watch': return 'DISPARAR CON PRECAUCIÓN';
    case 'do_not_fire': return 'NO DISPARAR TODAVÍA';
  }
}

export function triggerStatusColor(status: TriggerStatus): string {
  switch (status) {
    case 'fire_now': return 'green';
    case 'watch': return 'yellow';
    case 'do_not_fire': return 'red';
  }
}
