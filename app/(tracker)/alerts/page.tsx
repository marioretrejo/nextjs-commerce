'use client';

import { useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import {
  BellAlertIcon,
  CheckCircleIcon,
  EyeIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

interface AlertRecord {
  id: number;
  campaignBase: string;
  country: string;
  alertType: string;
  conversionRate: number;
  triggeredAt: string;
  status: string;
  details: string | null;
}

const ALERT_LABELS: Record<string, string> = {
  weekly_2_percent: '≥2% Semanal',
  monthly_2_percent: '≥2% Mensual'
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  seen: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  resolved: 'bg-slate-700 text-slate-400 border-slate-600'
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);

  const loadAlerts = useCallback(() => {
    setLoading(true);
    fetch(`/api/alerts?status=${statusFilter}&page=${page}&limit=30`)
      .then((r) => r.json())
      .then((d) => {
        setAlerts(d.alerts ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const updateStatus = async (id: number, status: string) => {
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    });
    loadAlerts();
  };

  const resolveAll = async () => {
    if (!confirm('¿Marcar todas las alertas activas como resueltas?')) return;
    await fetch('/api/alerts', { method: 'DELETE' });
    loadAlerts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Alertas</h1>
          <p className="text-sm text-slate-400">
            Notificaciones cuando una campaña + país alcanza el umbral de conversión.
          </p>
        </div>
        {statusFilter === 'active' && alerts.length > 0 && (
          <button
            onClick={resolveAll}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Resolver todas
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 w-fit">
        {['active', 'seen', 'resolved', 'all'].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={clsx(
              'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition',
              statusFilter === s
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white'
            )}
          >
            {s === 'active' ? 'Activas' : s === 'seen' ? 'Vistas' : s === 'resolved' ? 'Resueltas' : 'Todas'}
          </button>
        ))}
      </div>

      {/* Alerts list */}
      {loading ? (
        <p className="text-sm text-slate-500">Cargando alertas…</p>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
          <BellAlertIcon className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-2 text-sm text-slate-400">
            No hay alertas {statusFilter === 'active' ? 'activas' : statusFilter === 'seen' ? 'vistas' : 'resueltas'}.
          </p>
          {statusFilter === 'active' && (
            <p className="mt-1 text-xs text-slate-600">
              Las alertas se generan automáticamente cuando una campaña + país alcanza ≥2%.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={clsx(
                'rounded-xl border p-4',
                a.status === 'active'
                  ? 'border-amber-500/30 bg-amber-900/10'
                  : 'border-slate-700 bg-slate-900'
              )}
            >
              <div className="flex items-start gap-3">
                <BellAlertIcon
                  className={clsx(
                    'mt-0.5 h-5 w-5 flex-shrink-0',
                    a.status === 'active' ? 'text-amber-400' : 'text-slate-500'
                  )}
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-white">
                      {a.campaignBase} / {a.country}
                    </p>
                    <span
                      className={clsx(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                        ALERT_LABELS[a.alertType] ? 'border-indigo-500/30 bg-indigo-900/20 text-indigo-300' : 'border-slate-600 text-slate-400'
                      )}
                    >
                      {ALERT_LABELS[a.alertType] ?? a.alertType}
                    </span>
                    <span
                      className={clsx(
                        'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize',
                        STATUS_COLORS[a.status] ?? STATUS_COLORS.resolved
                      )}
                    >
                      {a.status === 'active' ? 'Activa' : a.status === 'seen' ? 'Vista' : 'Resuelta'}
                    </span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-green-400">
                    {a.conversionRate.toFixed(2)}%
                  </p>
                  {a.details && (
                    <p className="mt-0.5 text-sm text-slate-400">{a.details}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-600">
                    {new Date(a.triggeredAt).toLocaleString('es')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1">
                  {a.status === 'active' && (
                    <>
                      <button
                        onClick={() => updateStatus(a.id, 'seen')}
                        title="Marcar como vista"
                        className="rounded p-1 text-slate-500 hover:text-blue-400"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => updateStatus(a.id, 'resolved')}
                        title="Marcar como resuelta"
                        className="rounded p-1 text-slate-500 hover:text-green-400"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  {a.status === 'seen' && (
                    <button
                      onClick={() => updateStatus(a.id, 'resolved')}
                      title="Resolver"
                      className="rounded p-1 text-slate-500 hover:text-green-400"
                    >
                      <CheckCircleIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 30 && (
        <div className="flex items-center justify-between">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-xs text-slate-500">
            Página {page} · {total} alertas
          </span>
          <button
            disabled={page * 30 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
