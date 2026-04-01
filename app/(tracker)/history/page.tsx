'use client';

import { useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import {
  ClockIcon,
  BanknotesIcon,
  BellAlertIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';

type HistoryTab = 'ftds' | 'alerts' | 'crm';

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
  businessName: string;
  createdAt: string;
}

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

interface CrmRecord {
  id: number;
  campaignBase: string;
  country: string;
  actionType: string;
  reason: string | null;
  createdAt: string;
}

const ALERT_LABELS: Record<string, string> = {
  weekly_2_percent: '≥2% Semanal',
  monthly_2_percent: '≥2% Mensual'
};

const CRM_LABELS: Record<string, { label: string; cls: string }> = {
  duplicate: { label: 'Duplicar', cls: 'bg-green-500/20 text-green-400 border-green-500/30' },
  hide: { label: 'Ocultar', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
  monitor: { label: 'Monitorear', cls: 'bg-slate-700 text-slate-300 border-slate-600' }
};

export default function HistoryPage() {
  const [tab, setTab] = useState<HistoryTab>('ftds');
  const [ftds, setFtds] = useState<FtdRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [crm, setCrm] = useState<CrmRecord[]>([]);
  const [totalFtds, setTotalFtds] = useState(0);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [totalCrm, setTotalCrm] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const loadData = useCallback(() => {
    setLoading(true);
    const p = page;
    if (tab === 'ftds') {
      fetch(`/api/ftds?page=${p}&limit=30`)
        .then((r) => r.json())
        .then((d) => { setFtds(d.ftds ?? []); setTotalFtds(d.total ?? 0); })
        .finally(() => setLoading(false));
    } else if (tab === 'alerts') {
      fetch(`/api/alerts?status=all&page=${p}&limit=30`)
        .then((r) => r.json())
        .then((d) => { setAlerts(d.alerts ?? []); setTotalAlerts(d.total ?? 0); })
        .finally(() => setLoading(false));
    } else {
      fetch(`/api/crm?page=${p}&limit=30`)
        .then((r) => r.json())
        .then((d) => { setCrm(d.actions ?? []); setTotalCrm(d.total ?? 0); })
        .finally(() => setLoading(false));
    }
  }, [tab, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentTotal = tab === 'ftds' ? totalFtds : tab === 'alerts' ? totalAlerts : totalCrm;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Historial</h1>
        <p className="text-sm text-slate-400">Registro histórico de FTDs, alertas y acciones CRM.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 w-fit">
        <button
          onClick={() => { setTab('ftds'); setPage(1); }}
          className={clsx('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition', tab === 'ftds' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}
        >
          <BanknotesIcon className="h-3.5 w-3.5" />
          FTDs ({totalFtds})
        </button>
        <button
          onClick={() => { setTab('alerts'); setPage(1); }}
          className={clsx('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition', tab === 'alerts' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}
        >
          <BellAlertIcon className="h-3.5 w-3.5" />
          Alertas ({totalAlerts})
        </button>
        <button
          onClick={() => { setTab('crm'); setPage(1); }}
          className={clsx('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition', tab === 'crm' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white')}
        >
          <WrenchScrewdriverIcon className="h-3.5 w-3.5" />
          Acciones CRM ({totalCrm})
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          {/* FTDs table */}
          {tab === 'ftds' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              {ftds.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">No hay FTDs registrados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400">
                        <th className="px-4 py-2.5 text-left">Fecha Reg.</th>
                        <th className="px-4 py-2.5 text-left">Campaña / País</th>
                        <th className="px-4 py-2.5 text-left">Cliente</th>
                        <th className="px-4 py-2.5 text-right">Monto</th>
                        <th className="px-4 py-2.5 text-left">Tipo</th>
                        <th className="px-4 py-2.5 text-left">Proveedor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ftds.map((f) => (
                        <tr key={f.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="px-4 py-2.5 text-slate-300">
                            {new Date(f.registrationDate).toLocaleDateString('es')}
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-white">{f.campaignBase} / {f.country}</p>
                            {f.rawCampaignName !== f.campaignBase && (
                              <p className="text-xs text-slate-500">{f.rawCampaignName}</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-slate-300">{f.customerName}</td>
                          <td className="px-4 py-2.5 text-right text-white">${f.amount.toFixed(0)}</td>
                          <td className="px-4 py-2.5">
                            <span className={clsx('text-xs', f.isDelayedFtd ? 'text-amber-400' : 'text-green-400')}>
                              {f.isDelayedFtd ? 'Delayed' : 'Del día'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500">{f.providerSource}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Alerts table */}
          {tab === 'alerts' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              {alerts.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">No hay alertas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400">
                        <th className="px-4 py-2.5 text-left">Fecha</th>
                        <th className="px-4 py-2.5 text-left">Campaña / País</th>
                        <th className="px-4 py-2.5 text-left">Tipo</th>
                        <th className="px-4 py-2.5 text-right">Conversión</th>
                        <th className="px-4 py-2.5 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map((a) => (
                        <tr key={a.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                          <td className="px-4 py-2.5 text-slate-300">
                            {new Date(a.triggeredAt).toLocaleDateString('es')}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-white">
                            {a.campaignBase} / {a.country}
                          </td>
                          <td className="px-4 py-2.5 text-slate-300">
                            {ALERT_LABELS[a.alertType] ?? a.alertType}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-green-400">
                            {a.conversionRate.toFixed(2)}%
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs capitalize text-slate-400">{a.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* CRM table */}
          {tab === 'crm' && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
              {crm.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">No hay acciones CRM registradas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400">
                        <th className="px-4 py-2.5 text-left">Fecha</th>
                        <th className="px-4 py-2.5 text-left">Campaña / País</th>
                        <th className="px-4 py-2.5 text-left">Acción</th>
                        <th className="px-4 py-2.5 text-left">Razón</th>
                      </tr>
                    </thead>
                    <tbody>
                      {crm.map((c) => {
                        const lbl = CRM_LABELS[c.actionType] ?? CRM_LABELS['monitor']!;
                        return (
                          <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="px-4 py-2.5 text-slate-300">
                              {new Date(c.createdAt).toLocaleDateString('es')}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-white">
                              {c.campaignBase} / {c.country}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={clsx('rounded-full border px-2 py-0.5 text-xs font-medium', lbl.cls)}>
                                {lbl.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-400">{c.reason ?? '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Pagination */}
          {currentTotal > 30 && (
            <div className="flex items-center justify-between">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-xs text-slate-500">
                Página {page} · {currentTotal} registros
              </span>
              <button
                disabled={page * 30 >= currentTotal}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
