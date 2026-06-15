"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Phone,
  Plus,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScoringRubric {
  compliance: number;
  sales: number;
  soft_skills: number;
  conversation: number;
}

interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  qa_prompt: string | null;
  scoring_rubric: ScoringRubric;
  critical_criteria: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Extension {
  id: string;
  agent_extension: string;
  agent_name: string | null;
  created_at: string;
}

interface FormData {
  name: string;
  slug: string;
  description: string;
  qa_prompt: string;
  compliance: number;
  sales: number;
  soft_skills: number;
  conversation: number;
  critical_criteria: string[];
  is_active: boolean;
}

const CRITERIA_KEYS = ["compliance", "sales", "soft_skills", "conversation"] as const;
type CriteriaKey = typeof CRITERIA_KEYS[number];

const CRITERIA_LABELS: Record<CriteriaKey, string> = {
  compliance: "Compliance",
  sales: "Ventas",
  soft_skills: "Habilidades Sociales",
  conversation: "Conversación",
};

const DEFAULT_FORM: FormData = {
  name: "",
  slug: "",
  description: "",
  qa_prompt: "",
  compliance: 40,
  sales: 25,
  soft_skills: 20,
  conversation: 15,
  critical_criteria: [],
  is_active: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function rubricTotal(form: FormData): number {
  return form.compliance + form.sales + form.soft_skills + form.conversation;
}

function getRubric(dept: Department): ScoringRubric {
  const r = dept.scoring_rubric;
  if (r && typeof r === "object" && "compliance" in r) return r;
  return { compliance: 40, sales: 25, soft_skills: 20, conversation: 15 };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Extensions state
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [extensions, setExtensions] = useState<Record<string, Extension[]>>({});
  const [loadingExt, setLoadingExt] = useState<Record<string, boolean>>({});
  const [newExt, setNewExt] = useState({ agent_extension: "", agent_name: "" });
  const [addingExt, setAddingExt] = useState(false);

  // ── Fetch departments ─────────────────────────────────────────────────────

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/qac/departments?include_inactive=true");
      if (!res.ok) throw new Error("Failed to load departments");
      const data = await res.json() as { departments: Department[] };
      setDepartments(data.departments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchDepartments(); }, [fetchDepartments]);

  // ── Form helpers ──────────────────────────────────────────────────────────

  function openCreate() {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(dept: Department) {
    const r = getRubric(dept);
    setEditingId(dept.id);
    setForm({
      name: dept.name,
      slug: dept.slug,
      description: dept.description ?? "",
      qa_prompt: dept.qa_prompt ?? "",
      compliance: r.compliance,
      sales: r.sales,
      soft_skills: r.soft_skills,
      conversation: r.conversation,
      critical_criteria: Array.isArray(dept.critical_criteria) ? dept.critical_criteria : [],
      is_active: dept.is_active,
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }

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

  // ── Save department ───────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const total = rubricTotal(form);
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
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? "Failed to save department");
      }

      toast.success(editingId ? "Departamento actualizado" : "Departamento creado");
      closeForm();
      void fetchDepartments();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle active ─────────────────────────────────────────────────────────

  async function handleToggleActive(dept: Department) {
    try {
      const res = await fetch(`/api/qac/departments/${dept.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !dept.is_active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(dept.is_active ? "Departamento desactivado" : "Departamento activado");
      void fetchDepartments();
    } catch {
      toast.error("Error al actualizar el departamento");
    }
  }

  // ── Extensions ────────────────────────────────────────────────────────────

  async function fetchExtensions(deptId: string) {
    setLoadingExt((prev) => ({ ...prev, [deptId]: true }));
    try {
      const res = await fetch(`/api/qac/departments/${deptId}/extensions`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json() as { extensions: Extension[] };
      setExtensions((prev) => ({ ...prev, [deptId]: data.extensions ?? [] }));
    } catch {
      toast.error("Error al cargar extensiones");
    } finally {
      setLoadingExt((prev) => ({ ...prev, [deptId]: false }));
    }
  }

  function toggleExtensions(deptId: string) {
    if (expandedDept === deptId) {
      setExpandedDept(null);
      return;
    }
    setExpandedDept(deptId);
    setNewExt({ agent_extension: "", agent_name: "" });
    if (!extensions[deptId]) {
      void fetchExtensions(deptId);
    }
  }

  async function handleAddExtension(deptId: string) {
    if (!newExt.agent_extension.trim()) {
      toast.error("La extensión es requerida");
      return;
    }
    setAddingExt(true);
    try {
      const res = await fetch(`/api/qac/departments/${deptId}/extensions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_extension: newExt.agent_extension.trim(),
          agent_name: newExt.agent_name.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? "Failed to add");
      }
      setNewExt({ agent_extension: "", agent_name: "" });
      toast.success("Extensión agregada");
      void fetchExtensions(deptId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al agregar extensión");
    } finally {
      setAddingExt(false);
    }
  }

  async function handleDeleteExtension(deptId: string, agentExtension: string) {
    if (!confirm(`¿Eliminar extensión "${agentExtension}"?`)) return;
    try {
      const res = await fetch(`/api/qac/departments/${deptId}/extensions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_extension: agentExtension }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Extensión eliminada");
      void fetchExtensions(deptId);
    } catch {
      toast.error("Error al eliminar extensión");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const total = rubricTotal(form);
  const totalOk = Math.abs(total - 100) <= 1;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/qa-center"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="rounded-lg bg-violet-100 p-2">
              <Settings2 className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Departamentos QA</h1>
              <p className="text-sm text-gray-500">
                Configura reglas de análisis por departamento para llamadas VoIP externas
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" />
            Nuevo departamento
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="border-b border-gray-200 bg-violet-50 px-6 py-3">
        <p className="text-sm text-violet-700">
          Cada departamento configurado aquí controla cómo se analiza automáticamente cada llamada recibida
          desde proveedores VoIP (Squaretalk, Twilio, Aircall, etc.). La detección de departamento usa el
          campo <code className="rounded bg-violet-100 px-1 py-0.5 text-xs text-violet-700">agent_type</code> del
          proveedor o el mapeo de extensiones a continuación.
        </p>
      </div>

      <div className="p-6">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-600">
            {error}
            <button
              onClick={() => void fetchDepartments()}
              className="ml-3 underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && departments.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-20 text-center">
            <Building2 className="mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-500">No hay departamentos configurados</p>
            <p className="mt-1 text-sm text-gray-400">
              Crea un departamento para asignar reglas de QA específicas a cada equipo.
            </p>
            <button
              onClick={openCreate}
              className="mt-4 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              <Plus className="h-4 w-4" />
              Crear primer departamento
            </button>
          </div>
        )}

        {/* Department list */}
        {!loading && departments.length > 0 && (
          <div className="space-y-3">
            {departments.map((dept) => {
              const r = getRubric(dept);
              const isExpanded = expandedDept === dept.id;
              const deptExtensions = extensions[dept.id] ?? [];
              const isLoadingExt = loadingExt[dept.id] ?? false;

              return (
                <div
                  key={dept.id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  {/* Department header row */}
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 rounded-lg bg-violet-100 p-1.5 shrink-0">
                        <Building2 className="h-4 w-4 text-violet-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{dept.name}</span>
                          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                            {dept.slug}
                          </code>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              dept.is_active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {dept.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                        {dept.description && (
                          <p className="mt-0.5 text-sm text-gray-500">{dept.description}</p>
                        )}
                        {/* Scoring rubric summary */}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {CRITERIA_KEYS.map((k) => (
                            <span
                              key={k}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                                (dept.critical_criteria ?? []).includes(k)
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {CRITERIA_LABELS[k]}: {r[k]}%
                              {(dept.critical_criteria ?? []).includes(k) && (
                                <span title="Criterio crítico">⚠</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleExtensions(dept.id)}
                        className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        Extensiones
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => openEdit(dept)}
                        className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => void handleToggleActive(dept)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                          dept.is_active
                            ? "border-red-300 text-red-600 hover:border-red-400"
                            : "border-emerald-300 text-emerald-600 hover:border-emerald-400"
                        }`}
                      >
                        {dept.is_active ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>

                  {/* Extensions panel */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
                        Extensiones asignadas
                      </p>

                      {isLoadingExt && (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                        </div>
                      )}

                      {!isLoadingExt && (
                        <>
                          {deptExtensions.length === 0 && (
                            <p className="mb-3 text-sm text-gray-400">
                              Sin extensiones asignadas. Las llamadas se detectan por{" "}
                              <code className="text-xs text-gray-500">agent_type</code> del proveedor.
                            </p>
                          )}
                          {deptExtensions.length > 0 && (
                            <div className="mb-3 space-y-1">
                              {deptExtensions.map((ext) => (
                                <div
                                  key={ext.id}
                                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3.5 w-3.5 text-gray-400" />
                                    <span className="text-sm font-mono text-gray-900">
                                      {ext.agent_extension}
                                    </span>
                                    {ext.agent_name && (
                                      <span className="text-sm text-gray-500">
                                        — {ext.agent_name}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() =>
                                      void handleDeleteExtension(dept.id, ext.agent_extension)
                                    }
                                    className="rounded p-1 text-gray-400 transition-colors hover:text-red-500"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add extension form */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="Extensión (ej. 101)"
                              value={newExt.agent_extension}
                              onChange={(e) =>
                                setNewExt((p) => ({ ...p, agent_extension: e.target.value }))
                              }
                              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                            <input
                              type="text"
                              placeholder="Nombre (opcional)"
                              value={newExt.agent_name}
                              onChange={(e) =>
                                setNewExt((p) => ({ ...p, agent_name: e.target.value }))
                              }
                              className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                            />
                            <button
                              onClick={() => void handleAddExtension(dept.id)}
                              disabled={addingExt}
                              className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
                            >
                              {addingExt ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                              Agregar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create / Edit modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? "Editar departamento" : "Nuevo departamento"}
              </h2>
              <button
                onClick={closeForm}
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
                  onChange={(e) => updateForm({ slug: e.target.value.toLowerCase() })}
                  placeholder="ventas"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Solo minúsculas, números y guiones. Usado para detectar el departamento desde el proveedor.
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
                  Si está vacío, se usa el prompt global. Usa este campo para dar contexto específico: enfoque
                  en cierre de ventas, manejo de objeciones, cumplimiento FDCPA, etc.
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
                      <span className="w-40 text-sm text-gray-600">{CRITERIA_LABELS[k]}</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={form[k]}
                        onChange={(e) =>
                          updateForm({ [k]: Math.max(0, Math.min(100, Number(e.target.value))) })
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
                  Un score bajo en cualquiera de estos criterios marcará la llamada como riesgo crítico.
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
                    Solo los departamentos activos se usarán para detección en el webhook.
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
                  onClick={closeForm}
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
      )}
    </div>
  );
}
