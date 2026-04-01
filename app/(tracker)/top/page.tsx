'use client';

import { useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import {
  TrophyIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';

interface RankedCampaign {
  rank: number;
  campaignBase: string;
  country: string;
  conversionRate: number;
  totalFtds: number;
  totalLeads: number;
  periodType: string;
  triggerStatus: string;
  crmRecommendation: string | null;
  score: number;
  lastFtdAt: string | null;
}

const RANK_COLORS = [
  'bg-amber-500',
  'bg-slate-400',
  'bg-amber-700'
];

const RANK_BG = [
  'border-amber-500/30 bg-amber-900/10',
  'border-slate-600/50 bg-slate-800/30',
  'border-amber-700/30 bg-amber-900/5',
];

const CRM_LABELS: Record<string, { label: string; cls: string }> = {
  duplicate: { label: 'Duplicar', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  hide: { label: 'Ocultar', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  monitor: { label: 'Monitorear', cls: 'bg-slate-700 text-slate-300 border-slate-600' }
};

function TriggerBadge({ status }: { status: string }) {
  if (status === 'fire_now') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 border border-green-500/30 px-2 py-0.5 text-xs font-medium text-green-300">
        <BoltIcon className="h-3 w-3" /> DISPARAR
      </span>
    );
  }
  if (status === 'watch') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-300">
        <ExclamationTriangleIcon className="h-3 w-3" /> PRECAUCIÓN
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-slate-700 border border-slate-600 px-2 py-0.5 text-xs font-medium text-slate-400">
      EN ESPERA
    </span>
  );
}

export default function TopPage() {
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('weekly');
  const [ranking, setRanking] = useState<RankedCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(10);

  const loadRanking = useCallback(() => {
    setLoading(true);
    fetch(`/api/top?periodType=${periodType}&limit=${limit}`)
      .then((r) => r.json())
      .then((d) => {
        setRanking(d.ranking ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [periodType, limit]);

  useEffect(() => {
    loadRanking();
  }, [loadRanking]);

  // Top 3 spotlight
  const top3 = ranking.slice(0, 3);
  const rest = ranking.slice(3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Top Campaña / País</h1>
        <p className="text-sm text-slate-400">
          Ranking operativo por conversión, volumen y actividad reciente. Mínimo de leads requerido para calificar.
        </p>
      </div>

      {/* Period toggle */}
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 w-fit">
        {(['weekly', 'monthly'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodType(p)}
            className={clsx(
              'rounded-md px-4 py-1.5 text-xs font-medium transition',
              periodType === p ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            )}
          >
            {p === 'weekly' ? 'Semana (L–S)' : 'Mes'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Calculando ranking…</p>
      ) : ranking.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <TrophyIcon className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-2 text-sm text-slate-400">
            No hay campañas con volumen suficiente para el ranking.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Necesitas al menos {periodType === 'weekly' ? '20' : '40'} leads por campaña + país para calificar.
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 spotlight */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
              <TrophyIcon className="h-4 w-4 text-amber-400" />
              Prioridades Top
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {top3.map((c, i) => {
                const crm = CRM_LABELS[c.crmRecommendation ?? 'monitor'] ?? CRM_LABELS['monitor']!;
                return (
                  <div
                    key={`${c.campaignBase}-${c.country}`}
                    className={clsx('rounded-xl border p-4', RANK_BG[i] ?? 'border-slate-700 bg-slate-900')}
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className={clsx(
                          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white',
                          RANK_COLORS[i] ?? 'bg-slate-600'
                        )}
                      >
                        #{c.rank}
                      </div>
                      <TriggerBadge status={c.triggerStatus} />
                    </div>
                    <div className="mt-3">
                      <p className="font-bold text-white">{c.campaignBase}</p>
                      <p className="text-sm text-slate-400">{c.country}</p>
                    </div>
                    <div className="mt-3">
                      <p className={clsx('text-3xl font-bold', c.conversionRate >= 2 ? 'text-green-400' : 'text-white')}>
                        {c.conversionRate.toFixed(2)}%
                      </p>
                      <p className="text-sm text-slate-400">
                        {c.totalFtds} FTD / {c.totalLeads} leads
                      </p>
                    </div>
                    {c.lastFtdAt && (
                      <p className="mt-1 text-xs text-slate-600">
                        Último FTD: {new Date(c.lastFtdAt).toLocaleDateString('es')}
                      </p>
                    )}
                    <div className="mt-2">
                      <span className={clsx('rounded-full border px-2 py-0.5 text-xs font-medium', crm.cls)}>
                        {crm.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full ranking table */}
          {rest.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              <div className="border-b border-slate-800 px-4 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <ArrowTrendingUpIcon className="h-4 w-4 text-indigo-400" />
                  Ranking Completo
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-xs text-slate-400">
                      <th className="px-4 py-2.5 text-left">#</th>
                      <th className="px-4 py-2.5 text-left">Campaña</th>
                      <th className="px-4 py-2.5 text-left">País</th>
                      <th className="px-4 py-2.5 text-right">Conv. %</th>
                      <th className="px-4 py-2.5 text-right">FTD</th>
                      <th className="px-4 py-2.5 text-right">Leads</th>
                      <th className="px-4 py-2.5 text-left">Estado</th>
                      <th className="px-4 py-2.5 text-left">CRM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((c) => {
                      const crm = CRM_LABELS[c.crmRecommendation ?? 'monitor'] ?? CRM_LABELS['monitor']!;
                      return (
                        <tr
                          key={`${c.campaignBase}-${c.country}`}
                          className="border-b border-slate-800/50 hover:bg-slate-800/30"
                        >
                          <td className="px-4 py-2.5 text-slate-400">{c.rank}</td>
                          <td className="px-4 py-2.5 font-medium text-white">{c.campaignBase}</td>
                          <td className="px-4 py-2.5 text-slate-300">{c.country}</td>
                          <td className={clsx('px-4 py-2.5 text-right font-bold', c.conversionRate >= 2 ? 'text-green-400' : 'text-white')}>
                            {c.conversionRate.toFixed(2)}%
                          </td>
                          <td className="px-4 py-2.5 text-right text-white">{c.totalFtds}</td>
                          <td className="px-4 py-2.5 text-right text-slate-300">{c.totalLeads}</td>
                          <td className="px-4 py-2.5">
                            <TriggerBadge status={c.triggerStatus} />
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={clsx('rounded-full border px-2 py-0.5 text-xs font-medium', crm.cls)}>
                              {crm.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {total > limit && (
            <button
              onClick={() => setLimit((l) => l + 10)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs text-slate-300 hover:bg-slate-700"
            >
              Mostrar más ({total - limit} restantes)
            </button>
          )}
        </>
      )}
    </div>
  );
}
