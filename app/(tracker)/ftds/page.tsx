'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  BoltIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

interface FtdRecord {
  id: number;
  providerSource: string;
  campaignBase: string;
  rawCampaignName: string;
  country: string;
  customerName: string;
  amount: number;
  registrationDate: string;
  isDelayedFtd: boolean;
  isSameDay: boolean;
  createdAt: string;
}

interface TrendResult {
  direction: 'up' | 'down' | 'stable' | 'new';
  currentRate: number | null;
  previousRate: number | null;
  deltaPercent: number | null;
  deltaAbsolute: number | null;
}

interface HistoryRow {
  periodStart: string;
  conversionRate: number;
  totalFtds: number;
  totalLeads: number;
}

interface Analysis {
  campaign: string;
  country: string;
  rawCampaignName: string;
  isDelayed: boolean;
  isSameDay: boolean;
  weekly: { ftds: number; leads: number; conversion: number | null; pendingLeads: boolean };
  monthly: { ftds: number; leads: number; conversion: number | null; pendingLeads: boolean };
  trigger: {
    status: string;
    label: string;
    color: string;
    reasons: string[];
    crmRecommendation: string;
    crmReason: string;
  };
  weeklyRank: number | null;
  monthlyRank: number | null;
  trend?: { weekly: TrendResult; monthly: TrendResult };
  weeklyHistory?: HistoryRow[];
}

function SparkBars({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) return null;
  const maxRate = Math.max(...rows.map((r) => r.conversionRate), 0.01);
  return (
    <div className="flex items-end gap-1 h-8">
      {rows.map((r) => (
        <div
          key={r.periodStart}
          style={{ height: `${Math.max((r.conversionRate / maxRate) * 100, 4)}%` }}
          className={clsx('w-3 rounded-t flex-shrink-0', r.conversionRate >= 2 ? 'bg-green-500' : 'bg-slate-600')}
          title={`${new Date(r.periodStart).toLocaleDateString('es', { month: 'short', day: '2-digit' })}: ${r.conversionRate.toFixed(2)}%`}
        />
      ))}
    </div>
  );
}

function TrendLine({ trend, label }: { trend: TrendResult; label: string }) {
  if (trend.direction === 'new' || trend.previousRate === null) return null;
  const up = trend.direction === 'up';
  const down = trend.direction === 'down';
  const sign = (trend.deltaAbsolute ?? 0) > 0 ? '+' : '';
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-400">{label} ant.:</span>
      <span className="flex items-center gap-1">
        <span className="text-slate-300">{trend.previousRate.toFixed(2)}%</span>
        <span className={clsx('font-semibold', up ? 'text-green-400' : down ? 'text-red-400' : 'text-slate-400')}>
          {up ? '↑' : down ? '↓' : '→'} {sign}{trend.deltaAbsolute?.toFixed(2)}%
        </span>
      </span>
    </div>
  );
}

function TriggerCard({ analysis }: { analysis: Analysis }) {
  const { trigger } = analysis;
  const [crmSaving, setCrmSaving] = useState<string | null>(null);
  const [crmDone, setCrmDone] = useState<string | null>(null);

  const colorMap: Record<string, string> = {
    green: 'border-green-500/50 bg-green-900/20',
    yellow: 'border-amber-500/50 bg-amber-900/20',
    red: 'border-red-500/50 bg-red-900/20',
    gray: 'border-slate-700 bg-slate-800/50'
  };
  const textMap: Record<string, string> = {
    green: 'text-green-400',
    yellow: 'text-amber-400',
    red: 'text-red-400',
    gray: 'text-slate-400'
  };
  const IconMap: Record<string, React.ElementType> = {
    green: CheckCircleIcon,
    yellow: ExclamationTriangleIcon,
    red: XCircleIcon,
    gray: InformationCircleIcon
  };
  const Icon = IconMap[trigger.color] ?? InformationCircleIcon;
  const fmtPct = (v: number | null, pending: boolean) =>
    pending ? '⏳ Leads pendientes' : v === null ? '—' : `${v.toFixed(2)}%`;

  const handleCrm = async (action: string) => {
    setCrmSaving(action);
    try {
      await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignBase: analysis.campaign, country: analysis.country, actionType: action })
      });
      setCrmDone(action);
    } finally {
      setCrmSaving(null);
    }
  };

  const history = analysis.weeklyHistory ?? [];
  const profileHref = `/campaign/${encodeURIComponent(analysis.campaign)}/${encodeURIComponent(analysis.country)}`;

  return (
    <div className={clsx('rounded-xl border p-4 space-y-4', colorMap[trigger.color] ?? colorMap.gray)}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <Icon className={clsx('mt-0.5 h-6 w-6 flex-shrink-0', textMap[trigger.color])} />
        <div className="flex-1">
          <p className={clsx('text-lg font-bold', textMap[trigger.color])}>{trigger.label}</p>
          <p className="text-sm text-white">
            {analysis.campaign} / {analysis.country}
            {analysis.rawCampaignName !== analysis.campaign && (
              <span className="ml-2 text-xs text-slate-400">({analysis.rawCampaignName})</span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={clsx(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
              analysis.isDelayed ? 'border-amber-500/30 bg-amber-900/20 text-amber-400' : 'border-green-500/30 bg-green-900/20 text-green-400'
            )}
          >
            {analysis.isDelayed ? 'Delayed (D_)' : 'Del día'}
          </span>
          <Link href={profileHref} className="text-xs text-indigo-400 hover:underline">
            Ver perfil →
          </Link>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-slate-900/60 p-3">
          <p className="text-xs text-slate-400 mb-1">Semana</p>
          <p className={clsx('text-xl font-bold', (analysis.weekly.conversion ?? 0) >= 2 ? 'text-green-400' : 'text-white')}>
            {fmtPct(analysis.weekly.conversion, analysis.weekly.pendingLeads)}
          </p>
          <p className="text-xs text-slate-500">
            {analysis.weekly.ftds} FTD / {analysis.weekly.leads} leads
          </p>
          {analysis.weeklyRank && (
            <p className="mt-1 text-xs text-amber-400">🏆 Top #{analysis.weeklyRank} semanal</p>
          )}
        </div>
        <div className="rounded-lg bg-slate-900/60 p-3">
          <p className="text-xs text-slate-400 mb-1">Mes</p>
          <p className={clsx('text-xl font-bold', (analysis.monthly.conversion ?? 0) >= 2 ? 'text-green-400' : 'text-white')}>
            {fmtPct(analysis.monthly.conversion, analysis.monthly.pendingLeads)}
          </p>
          <p className="text-xs text-slate-500">
            {analysis.monthly.ftds} FTD / {analysis.monthly.leads} leads
          </p>
          {analysis.monthlyRank && (
            <p className="mt-1 text-xs text-amber-400">🏆 Top #{analysis.monthlyRank} mensual</p>
          )}
        </div>
      </div>

      {/* Historical context */}
      {(history.length > 0 || analysis.trend) && (
        <div className="rounded-lg bg-slate-900/60 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Contexto Histórico</p>
          {analysis.trend?.weekly && <TrendLine trend={analysis.trend.weekly} label="Semana" />}
          {analysis.trend?.monthly && <TrendLine trend={analysis.trend.monthly} label="Mes" />}
          {history.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-slate-500 mb-1">Últimas {history.length} semanas</p>
              <SparkBars rows={[...history].reverse()} />
            </div>
          )}
        </div>
      )}

      {/* Reasons */}
      <div className="space-y-1">
        {trigger.reasons.map((r, i) => (
          <p key={i} className="flex items-start gap-2 text-xs text-slate-300">
            <span className="mt-0.5 text-slate-500">•</span>
            {r}
          </p>
        ))}
      </div>

      {/* CRM actions */}
      <div className="space-y-2">
        <p className="text-xs text-slate-400">
          Acción CRM recomendada:{' '}
          <span className={clsx('font-medium',
            trigger.crmRecommendation === 'duplicate' ? 'text-green-400' :
            trigger.crmRecommendation === 'hide' ? 'text-red-400' : 'text-slate-300'
          )}>
            {trigger.crmRecommendation === 'duplicate' ? 'Duplicar campaña' :
             trigger.crmRecommendation === 'hide' ? 'Ocultar campaña' : 'Monitorear'}
          </span>
        </p>
        <div className="flex gap-2 flex-wrap">
          {[
            { action: 'duplicate', label: 'Duplicar', cls: 'border-green-600/40 bg-green-900/20 text-green-300 hover:bg-green-900/40' },
            { action: 'hide', label: 'Ocultar', cls: 'border-red-600/40 bg-red-900/20 text-red-300 hover:bg-red-900/40' },
            { action: 'monitor', label: 'Monitorear', cls: 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700' }
          ].map(({ action, label, cls }) => (
            <button
              key={action}
              onClick={() => handleCrm(action)}
              disabled={!!crmSaving || crmDone === action}
              className={clsx('rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50', cls,
                crmDone === action && 'opacity-100 ring-1 ring-current'
              )}
            >
              {crmDone === action ? '✓ ' : ''}{crmSaving === action ? 'Guardando…' : label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FtdsPage() {
  const [rawMessage, setRawMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    ok?: boolean;
    duplicate?: boolean;
    error?: string;
    ftd?: FtdRecord;
    analysis?: Analysis;
    message?: string;
  } | null>(null);
  const [ftds, setFtds] = useState<FtdRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [page, setPage] = useState(1);

  const loadFtds = useCallback(() => {
    setLoadingList(true);
    fetch(`/api/ftds?page=${page}&limit=20`)
      .then((r) => r.json())
      .then((d) => {
        setFtds(d.ftds ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoadingList(false));
  }, [page]);

  useEffect(() => {
    loadFtds();
  }, [loadFtds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawMessage.trim()) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/ftds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawMessage })
      });
      const data = await res.json();
      setResult(data);
      if (data.ok) {
        setRawMessage('');
        loadFtds();
      }
    } catch {
      setResult({ error: 'Error de conexión' });
    } finally {
      setSubmitting(false);
    }
  };

  const EXAMPLE = `Bridgerpay /Key2Pay
FTD
Moneda del mundo

Registration Date: 03/31/2026

RAUL RODRIGUEZ
$220.00
Xcore
Mexico
Rodreylis Rodriguez - Ruth`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Módulo FTDs</h1>
        <p className="text-sm text-slate-400">Pega un bloque de FTD para parsearlo y analizarlo en tiempo real.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Paste box */}
        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
            <label className="block text-sm font-semibold text-white">Pegar mensaje de FTD</label>
            <textarea
              value={rawMessage}
              onChange={(e) => setRawMessage(e.target.value)}
              rows={12}
              placeholder={EXAMPLE}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 p-3 font-mono text-sm text-white placeholder-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting || !rawMessage.trim()}
                className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {submitting ? 'Procesando…' : 'Procesar FTD'}
              </button>
              <button
                type="button"
                onClick={() => { setRawMessage(''); setResult(null); }}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700"
              >
                Limpiar
              </button>
            </div>
          </form>

          {/* Result */}
          {result && (
            <div>
              {result.error && (
                <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-4">
                  <p className="text-sm font-medium text-red-400">Error al procesar</p>
                  <p className="mt-1 text-sm text-red-300">{result.error}</p>
                </div>
              )}
              {result.duplicate && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-900/20 p-4">
                  <p className="text-sm font-medium text-amber-400">⚠ FTD Duplicado</p>
                  <p className="mt-1 text-sm text-amber-300">{result.message}</p>
                </div>
              )}
              {result.ok && result.analysis && (
                <TriggerCard analysis={result.analysis} />
              )}
            </div>
          )}
        </div>

        {/* FTD list */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              Historial FTDs{' '}
              <span className="ml-1 text-slate-500">({total})</span>
            </h2>
          </div>

          {loadingList ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : ftds.length === 0 ? (
            <p className="text-sm text-slate-500">No hay FTDs registrados.</p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-[520px]">
              {ftds.map((f) => (
                <div
                  key={f.id}
                  className="rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">
                        {f.campaignBase} / {f.country}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{f.customerName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {new Date(f.registrationDate).toLocaleDateString('es')} · {f.providerSource}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-medium text-white">${f.amount.toFixed(0)}</p>
                      <span className={clsx('text-xs', f.isDelayedFtd ? 'text-amber-400' : 'text-green-400')}>
                        {f.isDelayedFtd ? 'Delayed' : 'Del día'}
                      </span>
                    </div>
                  </div>
                  {f.rawCampaignName !== f.campaignBase && (
                    <p className="mt-0.5 text-xs text-slate-600">
                      Raw: {f.rawCampaignName}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > 20 && (
            <div className="mt-3 flex items-center justify-between">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-xs text-slate-500">
                {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} de {total}
              </span>
              <button
                disabled={page * 20 >= total}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
