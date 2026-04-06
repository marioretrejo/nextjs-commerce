'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  BoltIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface MetricItem {
  id: number;
  campaignBase: string;
  country: string;
  periodType: string;
  totalLeads: number;
  totalFtds: number;
  conversionRate: number;
  reached2Percent: boolean;
  triggerStatus: string;
  triggerReason: string | null;
  crmRecommendation: string | null;
  qualifiedForTop: boolean;
}

const TRIGGER_CONFIG = {
  fire_now: {
    label: 'DISPARAR AHORA',
    color: 'green',
    border: 'border-green-500/40',
    bg: 'bg-green-900/10',
    text: 'text-green-400',
    badge: 'bg-green-500/20 border-green-500/30 text-green-300',
    icon: BoltIcon
  },
  watch: {
    label: 'DISPARAR CON PRECAUCIÓN',
    color: 'yellow',
    border: 'border-amber-500/40',
    bg: 'bg-amber-900/10',
    text: 'text-amber-400',
    badge: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
    icon: ExclamationTriangleIcon
  },
  do_not_fire: {
    label: 'NO DISPARAR TODAVÍA',
    color: 'red',
    border: 'border-slate-700',
    bg: 'bg-slate-900',
    text: 'text-slate-400',
    badge: 'bg-slate-700 border-slate-600 text-slate-300',
    icon: XCircleIcon
  }
};

const CRM_LABELS: Record<string, { label: string; cls: string }> = {
  duplicate: { label: 'Duplicar campaña', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  hide: { label: 'Ocultar campaña', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  monitor: { label: 'Monitorear', cls: 'bg-slate-700 text-slate-300 border-slate-600' }
};

function MetricCard({ m }: { m: MetricItem }) {
  const cfg = TRIGGER_CONFIG[m.triggerStatus as keyof typeof TRIGGER_CONFIG] ?? TRIGGER_CONFIG.do_not_fire;
  const Icon = cfg.icon;
  const crm = CRM_LABELS[m.crmRecommendation ?? 'monitor'] ?? CRM_LABELS['monitor']!;
  const [crmSaving, setCrmSaving] = useState<string | null>(null);
  const [crmDone, setCrmDone] = useState<string | null>(null);
  const profileHref = `/campaign/${encodeURIComponent(m.campaignBase)}/${encodeURIComponent(m.country)}`;

  const handleCrm = async (actionType: string) => {
    setCrmSaving(actionType);
    try {
      await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignBase: m.campaignBase, country: m.country, actionType })
      });
      setCrmDone(actionType);
    } finally {
      setCrmSaving(null);
    }
  };

  return (
    <div className={clsx('rounded-xl border p-4', cfg.border, cfg.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Icon className={clsx('mt-0.5 h-5 w-5 flex-shrink-0', cfg.text)} />
          <div>
            <p className="font-semibold text-white">
              {m.campaignBase} / {m.country}
            </p>
            <p className={clsx('text-xs font-medium', cfg.text)}>{cfg.label}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={clsx('text-xl font-bold', m.reached2Percent ? 'text-green-400' : 'text-white')}>
            {m.conversionRate.toFixed(2)}%
          </p>
          <p className="text-xs text-slate-500 capitalize">{m.periodType}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-900/60 p-2 text-center">
          <p className="text-xs text-slate-400">FTD</p>
          <p className="text-base font-bold text-white">{m.totalFtds}</p>
        </div>
        <div className="rounded-lg bg-slate-900/60 p-2 text-center">
          <p className="text-xs text-slate-400">Leads</p>
          <p className="text-base font-bold text-white">{m.totalLeads}</p>
        </div>
        <div className="rounded-lg bg-slate-900/60 p-2 text-center">
          <p className="text-xs text-slate-400">≥2%</p>
          <p className="text-base font-bold">
            {m.reached2Percent ? (
              <span className="text-green-400">Sí</span>
            ) : (
              <span className="text-slate-500">No</span>
            )}
          </p>
        </div>
      </div>

      {m.triggerReason && (
        <p className="mt-2 text-xs text-slate-400">{m.triggerReason}</p>
      )}

      {/* CRM action buttons */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          { key: 'duplicate', label: 'Duplicar', cls: 'border-green-600/40 bg-green-900/20 text-green-300 hover:bg-green-900/40' },
          { key: 'hide', label: 'Ocultar', cls: 'border-red-600/40 bg-red-900/20 text-red-300 hover:bg-red-900/40' },
          { key: 'monitor', label: 'Monitorear', cls: 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700' }
        ].map(({ key, label, cls }) => (
          <button
            key={key}
            onClick={() => handleCrm(key)}
            disabled={!!crmSaving || crmDone === key}
            className={clsx('rounded-full border px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-50', cls,
              m.crmRecommendation === key && 'ring-1 ring-current'
            )}
          >
            {crmDone === key ? '✓ ' : ''}{crmSaving === key ? '…' : label}
          </button>
        ))}
        <Link
          href={profileHref}
          className="ml-auto text-xs text-indigo-400 hover:underline self-center"
        >
          Historial →
        </Link>
      </div>
    </div>
  );
}

export default function TriggerPage() {
  const [periodType, setPeriodType] = useState<'weekly' | 'monthly'>('weekly');
  const [filter, setFilter] = useState<'all' | 'fire_now' | 'watch' | 'do_not_fire'>('all');
  const [metrics, setMetrics] = useState<MetricItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const loadMetrics = useCallback(() => {
    setLoading(true);
    fetch(`/api/metrics?periodType=${periodType}`)
      .then((r) => r.json())
      .then((d) => setMetrics(d.metrics ?? []))
      .finally(() => setLoading(false));
  }, [periodType]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    await fetch('/api/metrics', { method: 'POST' });
    loadMetrics();
    setRecalculating(false);
  };

  const filtered = filter === 'all' ? metrics : metrics.filter((m) => m.triggerStatus === filter);

  const counts = {
    fire_now: metrics.filter((m) => m.triggerStatus === 'fire_now').length,
    watch: metrics.filter((m) => m.triggerStatus === 'watch').length,
    do_not_fire: metrics.filter((m) => m.triggerStatus === 'do_not_fire').length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">¿Cuándo Disparar?</h1>
          <p className="text-sm text-slate-400">
            Evaluación operativa de campañas: disparar, precaución o esperar.
          </p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          {recalculating ? 'Recalculando…' : '↻ Recalcular todo'}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-500/30 bg-green-900/10 p-3 text-center cursor-pointer" onClick={() => setFilter(filter === 'fire_now' ? 'all' : 'fire_now')}>
          <BoltIcon className="mx-auto h-6 w-6 text-green-400" />
          <p className="mt-1 text-2xl font-bold text-green-400">{counts.fire_now}</p>
          <p className="text-xs text-green-300">Disparar Ahora</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-3 text-center cursor-pointer" onClick={() => setFilter(filter === 'watch' ? 'all' : 'watch')}>
          <ExclamationTriangleIcon className="mx-auto h-6 w-6 text-amber-400" />
          <p className="mt-1 text-2xl font-bold text-amber-400">{counts.watch}</p>
          <p className="text-xs text-amber-300">Con Precaución</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-3 text-center cursor-pointer" onClick={() => setFilter(filter === 'do_not_fire' ? 'all' : 'do_not_fire')}>
          <XCircleIcon className="mx-auto h-6 w-6 text-slate-500" />
          <p className="mt-1 text-2xl font-bold text-slate-400">{counts.do_not_fire}</p>
          <p className="text-xs text-slate-500">No Disparar</p>
        </div>
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

      {/* Metrics grid */}
      {loading ? (
        <p className="text-sm text-slate-500">Cargando métricas…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <InformationCircleIcon className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-2 text-sm text-slate-400">
            No hay campañas que mostrar.
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Pega FTDs y carga leads para que el sistema evalúe las campañas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <MetricCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  );
}
