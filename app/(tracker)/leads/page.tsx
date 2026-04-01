'use client';

import { useEffect, useState, useCallback } from 'react';
import clsx from 'clsx';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

interface LeadRecord {
  id: number;
  date: string;
  campaignBase: string;
  country: string;
  leads: number;
  createdAt: string;
}

export default function LeadsPage() {
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    campaignBase: '',
    country: '',
    leads: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterCountry, setFilterCountry] = useState('');

  const loadLeads = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: '30',
      ...(filterCampaign ? { campaignBase: filterCampaign } : {}),
      ...(filterCountry ? { country: filterCountry } : {})
    });
    fetch(`/api/leads?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setLeads(d.leads ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [page, filterCampaign, filterCountry]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const leadsNum = parseInt(form.leads, 10);
    if (!form.date || !form.campaignBase.trim() || !form.country.trim() || isNaN(leadsNum) || leadsNum < 0) {
      setMessage({ type: 'error', text: 'Completa todos los campos correctamente.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          campaignBase: form.campaignBase.trim(),
          country: form.country.trim(),
          leads: leadsNum
        })
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: 'success', text: `✓ ${leadsNum} leads registrados para ${form.campaignBase} / ${form.country}` });
        setForm((f) => ({ ...f, campaignBase: '', country: '', leads: '' }));
        loadLeads();
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Error al guardar' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este registro de leads?')) return;
    await fetch(`/api/leads?id=${id}`, { method: 'DELETE' });
    loadLeads();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Carga de Leads</h1>
        <p className="text-sm text-slate-400">
          Registra los leads diarios por campaña y país. Los porcentajes se recalculan automáticamente.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-4 text-sm font-semibold text-white">Nuevo registro de leads</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Fecha</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">
                Campaña Base (CampaignId)
              </label>
              <input
                type="text"
                value={form.campaignBase}
                onChange={(e) => setForm((f) => ({ ...f, campaignBase: e.target.value }))}
                placeholder="ej. Xcore, Xpoint"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">País</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder="ej. Mexico, Uruguay, Ecuador"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-600">
                Una campaña puede tener múltiples países; se registran por separado.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Cantidad de Leads</label>
              <input
                type="number"
                min="0"
                value={form.leads}
                onChange={(e) => setForm((f) => ({ ...f, leads: e.target.value }))}
                placeholder="ej. 150"
                required
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {message && (
              <div
                className={clsx(
                  'rounded-lg border px-3 py-2 text-sm',
                  message.type === 'success'
                    ? 'border-green-500/30 bg-green-900/20 text-green-300'
                    : 'border-red-500/30 bg-red-900/20 text-red-300'
                )}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
              {submitting ? 'Guardando…' : 'Guardar Leads'}
            </button>
          </form>
        </div>

        {/* List */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              Registros <span className="text-slate-500">({total})</span>
            </h2>
          </div>

          {/* Filters */}
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              placeholder="Filtrar campaña…"
              value={filterCampaign}
              onChange={(e) => { setFilterCampaign(e.target.value); setPage(1); }}
              className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Filtrar país…"
              value={filterCountry}
              onChange={(e) => { setFilterCountry(e.target.value); setPage(1); }}
              className="flex-1 rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : leads.length === 0 ? (
            <p className="text-sm text-slate-500">No hay registros de leads.</p>
          ) : (
            <div className="space-y-1.5 overflow-y-auto max-h-[420px]">
              {leads.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {l.campaignBase} / {l.country}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(l.date).toLocaleDateString('es')}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-white">{l.leads.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">leads</p>
                  <button
                    onClick={() => handleDelete(l.id)}
                    className="ml-1 text-slate-600 hover:text-red-400"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {total > 30 && (
            <div className="mt-3 flex items-center justify-between">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <span className="text-xs text-slate-500">
                {(page - 1) * 30 + 1}–{Math.min(page * 30, total)} de {total}
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
      </div>
    </div>
  );
}
