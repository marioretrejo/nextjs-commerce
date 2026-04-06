'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  BoltIcon,
  ExclamationTriangleIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface CampaignSummary {
  campaignBase: string;
  country: string;
  lastActivity: string | null;
  weeklyConversion: number | null;
  weeklyFtds: number;
  weeklyLeads: number;
  triggerStatus: string;
  crmRecommendation: string | null;
  reached2Percent: boolean;
}

function TriggerBadge({ status }: { status: string }) {
  if (status === 'fire_now') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 border border-green-500/30 px-2 py-0.5 text-xs font-semibold text-green-300">
      <BoltIcon className="h-3 w-3" /> DISPARAR
    </span>
  );
  if (status === 'watch') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-xs font-semibold text-amber-300">
      <ExclamationTriangleIcon className="h-3 w-3" /> PRECAUCIÓN
    </span>
  );
  return (
    <span className="inline-flex rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs text-slate-400">
      EN ESPERA
    </span>
  );
}

const CRM_LABELS: Record<string, { label: string; cls: string }> = {
  duplicate: { label: 'Duplicar', cls: 'text-green-400' },
  hide: { label: 'Ocultar', cls: 'text-red-400' },
  monitor: { label: 'Monitorear', cls: 'text-slate-400' }
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState<'conversion' | 'activity' | 'ftds'>('conversion');

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/campaigns')
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = campaigns
    .filter((c) =>
      !filter ||
      c.campaignBase.toLowerCase().includes(filter.toLowerCase()) ||
      c.country.toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'conversion') return (b.weeklyConversion ?? -1) - (a.weeklyConversion ?? -1);
      if (sortBy === 'ftds') return b.weeklyFtds - a.weeklyFtds;
      return (b.lastActivity ? new Date(b.lastActivity).getTime() : 0) -
             (a.lastActivity ? new Date(a.lastActivity).getTime() : 0);
    });

  const fireNow = filtered.filter((c) => c.triggerStatus === 'fire_now').length;
  const reached = filtered.filter((c) => c.reached2Percent).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Todas las Campañas</h1>
          <p className="text-sm text-slate-400">
            {campaigns.length} combinaciones campaña + país activas · {fireNow} listas para disparar · {reached} sobre 2%
          </p>
        </div>
        <button onClick={load} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700">
          ↻ Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar campaña o país…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-64 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
        <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {([['conversion', 'Conversión'], ['ftds', 'FTDs'], ['activity', 'Actividad']] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={clsx('rounded-md px-3 py-1 text-xs font-medium transition', sortBy === key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando campañas…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <ChartBarIcon className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-2 text-sm text-slate-400">No hay campañas con datos aún.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400">
                  <th className="px-4 py-3 text-left">Campaña</th>
                  <th className="px-4 py-3 text-left">País</th>
                  <th className="px-4 py-3 text-right">Conv. Semanal</th>
                  <th className="px-4 py-3 text-right">FTD</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                  <th className="px-4 py-3 text-left">CRM</th>
                  <th className="px-4 py-3 text-left">Última actividad</th>
                  <th className="px-4 py-3 text-right">Perfil</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const crm = CRM_LABELS[c.crmRecommendation ?? 'monitor'] ?? CRM_LABELS['monitor']!;
                  const href = `/campaign/${encodeURIComponent(c.campaignBase)}/${encodeURIComponent(c.country)}`;
                  return (
                    <tr
                      key={`${c.campaignBase}|${c.country}`}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3 font-medium text-white">{c.campaignBase}</td>
                      <td className="px-4 py-3 text-slate-300">{c.country}</td>
                      <td className={clsx('px-4 py-3 text-right font-bold', c.reached2Percent ? 'text-green-400' : 'text-white')}>
                        {c.weeklyConversion !== null ? `${c.weeklyConversion.toFixed(2)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-white">{c.weeklyFtds}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{c.weeklyLeads}</td>
                      <td className="px-4 py-3"><TriggerBadge status={c.triggerStatus} /></td>
                      <td className={clsx('px-4 py-3 text-xs font-medium', crm.cls)}>{crm.label}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {c.lastActivity ? new Date(c.lastActivity).toLocaleDateString('es') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={href} className="text-xs text-indigo-400 hover:underline">
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
