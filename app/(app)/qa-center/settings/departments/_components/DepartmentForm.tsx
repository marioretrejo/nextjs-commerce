"use client";

import { useState } from "react";
import { Check, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import type { Department, FormData } from "./types";
import { CRITERIA_KEYS, CRITERIA_LABELS, DEFAULT_FORM } from "./constants";
import { getRubric, rubricTotal, toSlug } from "./helpers";

interface Props {
  dept: Department | null;
  onClose: () => void;
  onSaved: () => void;
}

function initialForm(dept: Department | null): FormData {
  if (!dept) return DEFAULT_FORM;
  const r = getRubric(dept);
  return {
    name: dept.name,
    slug: dept.slug,
    description: dept.description ?? "",
    qa_prompt: dept.qa_prompt ?? "",
    compliance: r.compliance,
    sales: r.sales,
    soft_skills: r.soft_skills,
    conversation: r.conversation,
    critical_criteria: Array.isArray(dept.critical_criteria)
      ? dept.critical_criteria
      : [],
    is_active: dept.is_active,
  };
}

export function DepartmentForm({ dept, onClose, onSaved }: Props) {
  const editingId = dept?.id ?? null;
  const [form, setForm] = useState<FormData>(() => initialForm(dept));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const total = rubricTotal(form);
  const totalOk = Math.abs(total - 100) <= 1;

  function updateForm(patch: Partial<FormData>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if ("name" in patch && !editingId) {
        next.slug = toSlug(next.name);
      }
      return next;
    });
  }

  function toggleCriteria(key: string) {
    setForm((prev) => {
      const has = prev.critical_criteria.includes(key);
      return {
        ...prev,
        critical_criteria: has
          ? prev.critical_criteria.filter((k) => k !== key)
          : [...prev.critical_criteria, key],
      };
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (Math.abs(total - 100) > 1) {
      setFormError(`Los pesos deben sumar 100. Suma actual: ${total}`);
      return;
    }
    if (!form.name.trim()) {
      setFormError("El nombre es requerido.");
      return;
    }
    if (!form.slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      setFormError("El slug debe ser letras minúsculas y guiones solamente.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        slug: form.slug,
        description: form.description.trim() || null,
        qa_prompt: form.qa_prompt.trim() || null,
        scoring_rubric: {
          compliance: form.compliance,
          sales: form.sales,
          soft_skills: form.soft_skills,
          conversation: form.conversation,
        },
        critical_criteria: form.critical_criteria,
        is_active: form.is_active,
      };

      const url = editingId
        ? `/api/qac/departments/${editingId}`
        : "/api/qac/departments";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Failed to save department");
      }

      toast.success(
        editingId ? "Departamento actualizado" : "Departamento creado",
      );
      onSaved();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl max-h-[90vh]">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingId ? "Editar departamento" : "Nuevo departamento"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSave(e)} className="space-y-5 p-6">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm({ name: e.target.value })}
              placeholder="ej. Ventas, Soporte, Cobranzas"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              required
            />
          </div>

          {/* Slug */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Slug <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) =>
                updateForm({ slug: e.target.value.toLowerCase() })
              }
              placeholder="ventas"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Solo minúsculas, números y guiones. Usado para detectar el
              departamento desde el proveedor.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Descripción
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
              placeholder="Descripción breve del departamento"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {/* QA Prompt */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Prompt QA del departamento
            </label>
            <textarea
              value={form.qa_prompt}
              onChange={(e) => updateForm({ qa_prompt: e.target.value })}
              rows={4}
              placeholder="Instrucciones específicas para la IA al analizar llamadas de este departamento. Si se deja vacío, se usará el prompt global estándar."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              Si está vacío, se usa el prompt global. Usa este campo para dar
              contexto específico: enfoque en cierre de ventas, manejo de
              objeciones, cumplimiento FDCPA, etc.
            </p>
          </div>

          {/* Scoring rubric */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                Pesos de scoring <span className="text-red-500">*</span>
              </label>
              <span
                className={`text-sm font-semibold ${
                  totalOk ? "text-emerald-600" : "text-red-600"
                }`}
              >
                Total: {total}%
                {totalOk && <Check className="ml-1 inline h-3.5 w-3.5" />}
              </span>
            </div>
            <div className="space-y-2">
              {CRITERIA_KEYS.map((k) => (
                <div key={k} className="flex items-center gap-3">
                  <span className="w-40 text-sm text-gray-600">
                    {CRITERIA_LABELS[k]}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form[k]}
                    onChange={(e) =>
                      updateForm({
                        [k]: Math.max(0, Math.min(100, Number(e.target.value))),
                      })
                    }
                    className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-center text-sm text-gray-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                  <span className="text-sm text-gray-400">%</span>
                  <div className="flex-1 rounded-full bg-gray-200 h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-violet-500 transition-all"
                      style={{ width: `${Math.min(100, form[k])}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {!totalOk && (
              <p className="mt-2 text-xs text-red-500">
                Los pesos deben sumar exactamente 100%. Suma actual: {total}%
              </p>
            )}
          </div>

          {/* Critical criteria */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              Criterios críticos
            </label>
            <p className="mb-2 text-xs text-gray-400">
              Un score bajo en cualquiera de estos criterios marcará la llamada
              como riesgo crítico.
            </p>
            <div className="flex flex-wrap gap-2">
              {CRITERIA_KEYS.map((k) => {
                const selected = form.critical_criteria.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleCriteria(k)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      selected
                        ? "border-amber-500 bg-amber-50 text-amber-700"
                        : "border-gray-300 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {selected && <Check className="h-3.5 w-3.5" />}
                    {CRITERIA_LABELS[k]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-700">Estado activo</p>
              <p className="text-xs text-gray-400">
                Solo los departamentos activos se usarán para detección en el
                webhook.
              </p>
            </div>
            <button
              type="button"
              onClick={() => updateForm({ is_active: !form.is_active })}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                form.is_active ? "bg-violet-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  form.is_active ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Form error */}
          {formError && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-600">
              {formError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !totalOk}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingId ? "Guardar cambios" : "Crear departamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
