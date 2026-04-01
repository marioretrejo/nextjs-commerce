'use client';

import { useEffect, useState } from 'react';
import { Cog6ToothIcon } from '@heroicons/react/24/outline';

interface Settings {
  id: number;
  weeklyThresholdPercent: number;
  monthlyThresholdPercent: number;
  weeklyMinLeadsForTop: number;
  monthlyMinLeadsForTop: number;
  weeklyMinLeadsForTrigger: number;
  monthlyMinLeadsForTrigger: number;
}

export default function SettingsPage() {
  const [form, setForm] = useState<Omit<Settings, 'id'>>({
    weeklyThresholdPercent: 2,
    monthlyThresholdPercent: 2,
    weeklyMinLeadsForTop: 20,
    monthlyMinLeadsForTop: 40,
    weeklyMinLeadsForTrigger: 20,
    monthlyMinLeadsForTrigger: 40
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) {
          const s = d.settings;
          setForm({
            weeklyThresholdPercent: s.weeklyThresholdPercent,
            monthlyThresholdPercent: s.monthlyThresholdPercent,
            weeklyMinLeadsForTop: s.weeklyMinLeadsForTop,
            monthlyMinLeadsForTop: s.monthlyMinLeadsForTop,
            weeklyMinLeadsForTrigger: s.weeklyMinLeadsForTrigger,
            monthlyMinLeadsForTrigger: s.monthlyMinLeadsForTrigger
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.ok) {
        setMessage({ type: 'success', text: 'Configuración guardada correctamente.' });
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Error al guardar' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setSaving(false);
    }
  };

  const field = (
    key: keyof typeof form,
    label: string,
    description: string,
    isPercent = false
  ) => (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex-1">
        <label className="block text-sm font-medium text-white">{label}</label>
        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step={isPercent ? '0.1' : '1'}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: parseFloat(e.target.value) }))}
          className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-right text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
        <span className="w-6 text-xs text-slate-500">{isPercent ? '%' : ''}</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-slate-400">Cargando configuración…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Configuración</h1>
        <p className="text-sm text-slate-400">
          Parámetros globales del sistema de campañas y conversión.
        </p>
      </div>

      <form onSubmit={handleSave}>
        {/* Thresholds */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Cog6ToothIcon className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Umbrales de Conversión</h2>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Porcentaje mínimo para activar alertas y lógica de disparo.
          </p>
          <div className="divide-y divide-slate-800">
            {field('weeklyThresholdPercent', 'Umbral Semanal', 'FTD/Leads × 100 ≥ este valor = alerta semanal', true)}
            {field('monthlyThresholdPercent', 'Umbral Mensual', 'FTD/Leads × 100 ≥ este valor = alerta mensual', true)}
          </div>
        </div>

        {/* Volume minimums */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 mt-4">
          <h2 className="mb-1 text-sm font-semibold text-white">Volumen Mínimo para Top Ranking</h2>
          <p className="mb-3 text-xs text-slate-500">
            Leads mínimos para que una campaña + país aparezca en el ranking. Evita falsos positivos.
          </p>
          <div className="divide-y divide-slate-800">
            {field('weeklyMinLeadsForTop', 'Mín. Leads Semanal (Top)', 'Campañas con menos leads no aparecerán en el ranking semanal')}
            {field('monthlyMinLeadsForTop', 'Mín. Leads Mensual (Top)', 'Campañas con menos leads no aparecerán en el ranking mensual')}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 mt-4">
          <h2 className="mb-1 text-sm font-semibold text-white">Volumen Mínimo para Disparar</h2>
          <p className="mb-3 text-xs text-slate-500">
            Leads mínimos para que el sistema recomiende "DISPARAR AHORA".
          </p>
          <div className="divide-y divide-slate-800">
            {field('weeklyMinLeadsForTrigger', 'Mín. Leads Semanal (Trigger)', 'Se necesita este volumen para recomendar disparo semanal')}
            {field('monthlyMinLeadsForTrigger', 'Mín. Leads Mensual (Trigger)', 'Se necesita este volumen para recomendar disparo mensual')}
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              message.type === 'success'
                ? 'border-green-500/30 bg-green-900/20 text-green-300'
                : 'border-red-500/30 bg-red-900/20 text-red-300'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar Configuración'}
          </button>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700"
          >
            Cancelar
          </button>
        </div>
      </form>

      {/* Info box */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-xs text-slate-500 space-y-1">
        <p className="font-medium text-slate-400">Lógica de negocio:</p>
        <p>• Conversión = FTD / Leads × 100</p>
        <p>• Semana: Lunes → Sábado</p>
        <p>• Mes: Día 1 → último día del mes</p>
        <p>• FTD delayed = tiene prefijo D_ y/o fecha != hoy</p>
        <p>• Los FTDs del día NO activan la lógica de disparo</p>
        <p>• El top excluye campañas con volumen por debajo del mínimo</p>
      </div>
    </div>
  );
}
