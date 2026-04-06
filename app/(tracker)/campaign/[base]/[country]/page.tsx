'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import {
  ArrowLeftIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  BanknotesIcon,
  WrenchScrewdriverIcon,
  BellAlertIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

interface PeriodSummary {
  periodStart: string;
  periodEnd: string;
  totalLeads: number;
  totalFtds: number;
  conversionRate: number;
  reached2Percent: boolean;
  triggerStatus: string;
  topRank: number | null;
}

interface TrendResult {
  direction: 'up' | 'down' | 'stable' | 'new';
  currentRate: number | null;
  previousRate: number | null;
  deltaPercent: number | null;
  deltaAbsolute: number | null;
}

interface Profile {
  campaignBase: string;
  country: string;
  weeklyHistory: PeriodSummary[];
  monthlyHistory: PeriodSummary[];
  recentFtds: {
    id: number;
    registrationDate: string;
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
    executedAt: string | null;
    createdAt: string;
  }[];
  activeAlerts: {
    id: number;
    alertType: string;
    conversionRate: number;
    triggeredAt: string;
    details: string | null;
  }[];
  rankHistory: {
    periodStart: string;
    periodType: string;
    rank: number;
    conversionRate: number;
  }[];
  trend: {
    weekly: TrendResult;
    monthly: TrendResult;
  };
}

function TrendIcon({ direction }: { direction: string }) {
  if (direction === 'up') return <ArrowTrendingUpIcon className="h-4 w-4 text-green-400" />;
  if (direction === 'down') return <ArrowTrendingDownIcon className="h-4 w-4 text-red-400" />;
  if (direction === 'stable') return <MinusIcon className="h-4 w-4 text-slate-400" />;
  return null;
}

function TrendBadge({ trend }: { trend: TrendResult }) {
  if (trend.direction === 'new' || trend.deltaAbsolute === null) {
    return <span className="text-xs text-slate-500">Sin período anterior</span>;
  }
  const sign = trend.deltaAbsolute >= 0 ? '+' : '';
  const color = trend.direction === 'up' ? 'text-green-400' : trend.direction === 'down' ? 'text-red-400' : 'text-slate-400';
  return (
    <span className={clsx('inline-flex items-center gap-1 text-sm font-medium', color)}>
      <TrendIcon direction={trend.direction} />
      {sign}{trend.deltaAbsolute.toFixed(2)}pp vs período anterior
      {trend.deltaPercent !== null && (
        <span className="text-xs opacity-70">({sign}{trend.deltaPercent.toFixed(1)}%)</span>
      )}
    </span>
  );
}

// Mini bar chart using CSS
function SparkBars({ data, maxRate }: { data: PeriodSummary[]; maxRate: number }) {
  if (data.length === 0) return <p className="text-xs text-slate-500">Sin datos</p>;
  const reversed = [...data].reverse(); // oldest to newest
  return (
    <div className="flex items-end gap-1" style={{ height: 48 }}>
      {reversed.map((d, i) => {
        const height = maxRate > 0 ? Math.max((d.conversionRate / maxRate) * 100, 4) : 4;
        return (
          <div
            key={i}
            className="group relative flex-1"
            style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}
          >
            <div
              style={{ height: `${height}%` }}
              className={clsx('w-full rounded-t transition-all', d.reached2Percent ? 'bg-green-500' : 'bg-slate-600 group-hover:bg-indigo-500')}
              title={`${d.conversionRate.toFixed(2)}% — ${new Date(d.periodStart).toLocaleDateString('es', { month: 'short', day: '2-digit' })}`}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 whitespace-nowrap rounded bg-slate-700 px-2 py-1 text-xs text-white shadow-lg">
              {d.conversionRate.toFixed(2)}%<br />
              {d.totalFtds} FTD / {d.totalLeads} leads
            </div>
          </div>
        );
      })}
    </div>
  );
}

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  duplicate: { label: 'Duplicar campaña', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  hide: { label: 'Ocultar campaña', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  monitor: { label: 'Monitorear', cls: 'bg-slate-700 text-slate-300 border-slate-600' }
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  executed: 'Ejecutada',
  skipped: 'Omitida'
};

export default function CampaignProfilePage() {
  const params = useParams();
  const base = decodeURIComponent(params['base'] as string);
  const country = decodeURIComponent(params['country'] as string);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [crmSaving, setCrmSaving] = useState(false);
  const [crmMessage, setCrmMessage] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/campaign/${encodeURIComponent(base)}/${encodeURIComponent(country)}`)
      .then((r) => r.json())
      .then((d) => setProfile(d.profile))
      .finally(() => setLoading(false));
  }, [base, country]);

  useEffect(() => { load(); }, [load]);

  const recordCrmAction = async (actionType: string) => {
    setCrmSaving(true);
    setCrmMessage('');
    try {
      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignBase: base, country, actionType, reason: 'Registrado desde perfil de campaña' })
      });
      if (res.ok) {
        setCrmMessage(`✓ Acción "${ACTION_LABELS[actionType]?.label ?? actionType}" registrada.`);
        load();
      }
    } finally {
      setCrmSaving(false);
    }
  };

  const updateCrmStatus = async (id: number, status: string) => {
    await fetch(`/api/crm/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    load();
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <p className="text-slate-400">Cargando perfil…</p>
    </div>
  );

  if (!profile) return (
    <div className="text-center py-12">
      <p className="text-red-400">No se encontró la campaña.</p>
      <Link href="/campaigns" className="mt-2 inline-block text-sm text-indigo-400 hover:underline">← Volver</Link>
    </div>
  );

  const maxWeeklyRate = Math.max(...profile.weeklyHistory.map((w) => w.conversionRate), 0.01);
  const maxMonthlyRate = Math.max(...profile.monthlyHistory.map((m) => m.conversionRate), 0.01);

  const latestWeekly = profile.weeklyHistory[0];
  const latestMonthly = profile.monthlyHistory[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/campaigns" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-3">
          <ArrowLeftIcon className="h-3 w-3" /> Todas las campañas
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{profile.campaignBase}</h1>
            <p className="text-slate-400">{profile.country}</p>
          </div>
          {latestWeekly && (
            <div className={clsx(
              'rounded-xl border px-4 py-2 text-center',
              latestWeekly.reached2Percent ? 'border-green-500/40 bg-green-900/10' : 'border-slate-700 bg-slate-900'
            )}>
              <p className={clsx('text-2xl font-bold', latestWeekly.reached2Percent ? 'text-green-400' : 'text-white')}>
                {latestWeekly.conversionRate.toFixed(2)}%
              </p>
              <p className="text-xs text-slate-400">Esta semana</p>
            </div>
          )}
        </div>
      </div>

      {/* Trend summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Tendencia Semanal</p>
          <TrendBadge trend={profile.trend.weekly} />
          {profile.trend.weekly.previousRate !== null && (
            <p className="mt-1 text-xs text-slate-500">
              Período anterior: {profile.trend.weekly.previousRate.toFixed(2)}%
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Tendencia Mensual</p>
          <TrendBadge trend={profile.trend.monthly} />
          {profile.trend.monthly.previousRate !== null && (
            <p className="mt-1 text-xs text-slate-500">
              Período anterior: {profile.trend.monthly.previousRate.toFixed(2)}%
            </p>
          )}
        </div>
      </div>

      {/* Weekly history chart */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <ArrowTrendingUpIcon className="h-4 w-4 text-indigo-400" />
            Historial Semanal (últimas {profile.weeklyHistory.length} semanas)
          </h2>
          <span className="text-xs text-slate-500">Hover sobre barras para detalle</span>
        </div>

        {/* Spark bars */}
        <div className="mb-4">
          <SparkBars data={profile.weeklyHistory} maxRate={maxWeeklyRate} />
          <div className="mt-1 flex justify-between text-xs text-slate-600">
            {[...profile.weeklyHistory].reverse().map((w, i) => (
              <span key={i} className="text-center" style={{ flex: 1 }}>
                {new Date(w.periodStart).toLocaleDateString('es', { month: 'short', day: '2-digit' })}
              </span>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400">
                <th className="py-2 text-left">Semana</th>
                <th className="py-2 text-right">Conv.</th>
                <th className="py-2 text-right">FTD</th>
                <th className="py-2 text-right">Leads</th>
                <th className="py-2 text-center">≥2%</th>
                <th className="py-2 text-center">Top</th>
              </tr>
            </thead>
            <tbody>
              {profile.weeklyHistory.map((w, i) => (
                <tr key={i} className="border-b border-slate-800/50">
                  <td className="py-2 text-slate-300">
                    {new Date(w.periodStart).toLocaleDateString('es', { day: '2-digit', month: 'short' })}–
                    {new Date(w.periodEnd).toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                    {i === 0 && <span className="ml-1 text-xs text-indigo-400">(actual)</span>}
                  </td>
                  <td className={clsx('py-2 text-right font-bold', w.reached2Percent ? 'text-green-400' : 'text-white')}>
                    {w.conversionRate.toFixed(2)}%
                  </td>
                  <td className="py-2 text-right text-white">{w.totalFtds}</td>
                  <td className="py-2 text-right text-slate-300">{w.totalLeads}</td>
                  <td className="py-2 text-center">{w.reached2Percent ? '✓' : '—'}</td>
                  <td className="py-2 text-center text-slate-400">{w.topRank ? `#${w.topRank}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly history */}
      {profile.monthlyHistory.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">
            Historial Mensual (últimos {profile.monthlyHistory.length} meses)
          </h2>
          <div className="mb-4">
            <SparkBars data={profile.monthlyHistory} maxRate={maxMonthlyRate} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="py-2 text-left">Mes</th>
                  <th className="py-2 text-right">Conv.</th>
                  <th className="py-2 text-right">FTD</th>
                  <th className="py-2 text-right">Leads</th>
                  <th className="py-2 text-center">≥2%</th>
                </tr>
              </thead>
              <tbody>
                {profile.monthlyHistory.map((m, i) => (
                  <tr key={i} className="border-b border-slate-800/50">
                    <td className="py-2 text-slate-300">
                      {new Date(m.periodStart).toLocaleDateString('es', { month: 'long', year: 'numeric' })}
                      {i === 0 && <span className="ml-1 text-xs text-indigo-400">(actual)</span>}
                    </td>
                    <td className={clsx('py-2 text-right font-bold', m.reached2Percent ? 'text-green-400' : 'text-white')}>
                      {m.conversionRate.toFixed(2)}%
                    </td>
                    <td className="py-2 text-right text-white">{m.totalFtds}</td>
                    <td className="py-2 text-right text-slate-300">{m.totalLeads}</td>
                    <td className="py-2 text-center">{m.reached2Percent ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CRM Actions panel */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
          <WrenchScrewdriverIcon className="h-4 w-4 text-indigo-400" />
          Acciones CRM
        </h2>

        {/* Record new action */}
        <div className="mb-4 flex flex-wrap gap-2">
          <p className="w-full text-xs text-slate-400 mb-1">Registrar acción:</p>
          {(['duplicate', 'hide', 'monitor'] as const).map((type) => {
            const lbl = ACTION_LABELS[type]!;
            return (
              <button
                key={type}
                disabled={crmSaving}
                onClick={() => recordCrmAction(type)}
                className={clsx(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-40',
                  lbl.cls
                )}
              >
                {lbl.label}
              </button>
            );
          })}
          {crmMessage && <p className="w-full text-xs text-green-400 mt-1">{crmMessage}</p>}
        </div>

        {/* Action history */}
        {profile.crmActions.length === 0 ? (
          <p className="text-xs text-slate-500">Sin acciones CRM registradas.</p>
        ) : (
          <div className="space-y-2">
            {profile.crmActions.map((a) => {
              const lbl = ACTION_LABELS[a.actionType] ?? ACTION_LABELS['monitor']!;
              return (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2">
                  <span className={clsx('rounded-full border px-2 py-0.5 text-xs font-medium flex-shrink-0', lbl.cls)}>
                    {lbl.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    {a.reason && <p className="text-xs text-slate-400 truncate">{a.reason}</p>}
                    <p className="text-xs text-slate-600">
                      {new Date(a.createdAt).toLocaleDateString('es')} · {STATUS_LABELS[a.status] ?? a.status}
                      {a.executedAt && ` · Ejecutada: ${new Date(a.executedAt).toLocaleDateString('es')}`}
                    </p>
                  </div>
                  {a.status === 'pending' && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => updateCrmStatus(a.id, 'executed')}
                        className="rounded px-2 py-1 text-xs text-green-400 border border-green-500/30 hover:bg-green-900/20"
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => updateCrmStatus(a.id, 'skipped')}
                        className="rounded px-2 py-1 text-xs text-slate-400 border border-slate-600 hover:bg-slate-700"
                      >
                        Omitir
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom grid: FTDs + Alerts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent FTDs */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <BanknotesIcon className="h-4 w-4 text-indigo-400" />
            FTDs Recientes ({profile.recentFtds.length})
          </h2>
          {profile.recentFtds.length === 0 ? (
            <p className="text-xs text-slate-500">Sin FTDs.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {profile.recentFtds.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded border border-slate-700/50 bg-slate-800/50 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{f.customerName}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(f.registrationDate).toLocaleDateString('es')} · {f.rawCampaignName}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-white">${f.amount.toFixed(0)}</p>
                    <span className={clsx('text-xs', f.isDelayedFtd ? 'text-amber-400' : 'text-green-400')}>
                      {f.isDelayedFtd ? 'D' : '✓'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active alerts */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
            <BellAlertIcon className="h-4 w-4 text-amber-400" />
            Alertas Activas ({profile.activeAlerts.length})
          </h2>
          {profile.activeAlerts.length === 0 ? (
            <p className="text-xs text-slate-500">Sin alertas activas.</p>
          ) : (
            <div className="space-y-2">
              {profile.activeAlerts.map((a) => (
                <div key={a.id} className="rounded border border-amber-500/30 bg-amber-900/10 px-3 py-2">
                  <p className="text-sm font-bold text-green-400">{a.conversionRate.toFixed(2)}%</p>
                  <p className="text-xs text-amber-300">
                    {a.alertType === 'weekly_2_percent' ? '≥2% Semanal' : '≥2% Mensual'}
                  </p>
                  {a.details && <p className="text-xs text-slate-400 mt-0.5">{a.details}</p>}
                  <p className="text-xs text-slate-500">{new Date(a.triggeredAt).toLocaleString('es')}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
