'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BanknotesIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  BellAlertIcon,
  BoltIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface DashboardData {
  today: { ftds: number; leads: number };
  weekly: { ftds: number; leads: number; conversion: number | null; range: { start: string; end: string } };
  monthly: { ftds: number; leads: number; conversion: number | null };
  activeAlerts: number;
  fireNowCount: number;
  topWeekly: {
    id: number;
    campaignBase: string;
    country: string;
    conversionRate: number;
    totalFtds: number;
    totalLeads: number;
    triggerStatus: string;
  }[];
  recentFtds: {
    id: number;
    campaignBase: string;
    country: string;
    customerName: string;
    registrationDate: string;
    isDelayedFtd: boolean;
    isSameDay: boolean;
    amount: number;
  }[];
}

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  color = 'indigo',
  href
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color?: string;
  href?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-600/20 text-indigo-400',
    green: 'bg-green-600/20 text-green-400',
    amber: 'bg-amber-600/20 text-amber-400',
    red: 'bg-red-600/20 text-red-400',
    blue: 'bg-blue-600/20 text-blue-400'
  };
  const card = (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={clsx('rounded-lg p-2', colorMap[color] ?? colorMap.indigo)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

function TriggerBadge({ status }: { status: string }) {
  if (status === 'fire_now') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
        <BoltIcon className="h-3 w-3" /> DISPARAR
      </span>
    );
  }
  if (status === 'watch') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400">
        <ExclamationTriangleIcon className="h-3 w-3" /> PRECAUCIÓN
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-400">
      EN ESPERA
    </span>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">Cargando dashboard…</p>
      </div>
    );
  }

  if (!data) {
    return <p className="text-red-400">Error al cargar datos.</p>;
  }

  const fmtPct = (v: number | null) =>
    v === null ? '—' : `${v.toFixed(2)}%`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400">
          Semana: {new Date(data.weekly.range.start).toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short' })} –{' '}
          {new Date(data.weekly.range.end).toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short' })}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          title="FTD Hoy"
          value={String(data.today.ftds)}
          sub={`${data.today.leads} leads hoy`}
          icon={BanknotesIcon}
          color="green"
          href="/ftds"
        />
        <MetricCard
          title="Conversión Semanal"
          value={fmtPct(data.weekly.conversion)}
          sub={`${data.weekly.ftds} FTD / ${data.weekly.leads} leads`}
          icon={ArrowTrendingUpIcon}
          color={data.weekly.conversion !== null && data.weekly.conversion >= 2 ? 'green' : 'indigo'}
        />
        <MetricCard
          title="Conversión Mensual"
          value={fmtPct(data.monthly.conversion)}
          sub={`${data.monthly.ftds} FTD / ${data.monthly.leads} leads`}
          icon={ArrowTrendingUpIcon}
          color={data.monthly.conversion !== null && data.monthly.conversion >= 2 ? 'green' : 'blue'}
        />
        <MetricCard
          title="Alertas Activas"
          value={String(data.activeAlerts)}
          sub={`${data.fireNowCount} listas para disparar`}
          icon={BellAlertIcon}
          color={data.activeAlerts > 0 ? 'amber' : 'indigo'}
          href="/alerts"
        />
      </div>

      {/* Bottom two panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top 3 Weekly */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <TrophyIcon className="h-4 w-4 text-amber-400" />
              Top Campaña / País (Semana)
            </h2>
            <Link href="/top" className="text-xs text-indigo-400 hover:underline">
              Ver todo →
            </Link>
          </div>
          {data.topWeekly.length === 0 ? (
            <p className="text-sm text-slate-500">
              Sin datos suficientes aún. Carga leads y FTDs para ver el ranking.
            </p>
          ) : (
            <div className="space-y-2">
              {data.topWeekly.map((c, i) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2"
                >
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-400">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {c.campaignBase} / {c.country}
                    </p>
                    <p className="text-xs text-slate-400">
                      {c.totalFtds} FTD / {c.totalLeads} leads
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={clsx('text-sm font-bold', c.conversionRate >= 2 ? 'text-green-400' : 'text-white')}>
                      {c.conversionRate.toFixed(2)}%
                    </p>
                    <TriggerBadge status={c.triggerStatus} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent FTDs */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <BanknotesIcon className="h-4 w-4 text-indigo-400" />
              FTDs Recientes
            </h2>
            <Link href="/ftds" className="text-xs text-indigo-400 hover:underline">
              Ver todo →
            </Link>
          </div>
          {data.recentFtds.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay FTDs registrados. Pega un mensaje en el módulo FTDs.
            </p>
          ) : (
            <div className="space-y-2">
              {data.recentFtds.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {f.campaignBase} / {f.country}
                    </p>
                    <p className="truncate text-xs text-slate-400">{f.customerName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      ${f.amount.toFixed(0)}
                    </p>
                    <span
                      className={clsx(
                        'text-xs',
                        f.isDelayedFtd ? 'text-amber-400' : 'text-green-400'
                      )}
                    >
                      {f.isDelayedFtd ? 'Delayed' : 'Del día'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Acciones Rápidas</h2>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/ftds"
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            <BanknotesIcon className="h-4 w-4" />
            Pegar FTD
          </Link>
          <Link
            href="/leads"
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            <UsersIcon className="h-4 w-4" />
            Cargar Leads
          </Link>
          <Link
            href="/trigger"
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            <BoltIcon className="h-4 w-4" />
            ¿Cuándo Disparar?
          </Link>
          {data.activeAlerts > 0 && (
            <Link
              href="/alerts"
              className="flex items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-900/30"
            >
              <BellAlertIcon className="h-4 w-4" />
              Ver {data.activeAlerts} alerta{data.activeAlerts > 1 ? 's' : ''}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
