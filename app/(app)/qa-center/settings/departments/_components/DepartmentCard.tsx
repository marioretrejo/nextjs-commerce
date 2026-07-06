"use client";

import { useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Department, Extension } from "./types";
import { CRITERIA_KEYS, CRITERIA_LABELS } from "./constants";
import { getRubric } from "./helpers";

interface Props {
  dept: Department;
  onEdit: (dept: Department) => void;
  onToggleActive: (dept: Department) => void;
}

export function DepartmentCard({ dept, onEdit, onToggleActive }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [extensions, setExtensions] = useState<Extension[] | null>(null);
  const [loadingExt, setLoadingExt] = useState(false);
  const [newExt, setNewExt] = useState({ agent_extension: "", agent_name: "" });
  const [addingExt, setAddingExt] = useState(false);

  const r = getRubric(dept);
  const deptExtensions = extensions ?? [];

  async function fetchExtensions() {
    setLoadingExt(true);
    try {
      const res = await fetch(`/api/qac/departments/${dept.id}/extensions`);
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as { extensions: Extension[] };
      setExtensions(data.extensions ?? []);
    } catch {
      toast.error("Error al cargar extensiones");
    } finally {
      setLoadingExt(false);
    }
  }

  function toggleExtensions() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    setNewExt({ agent_extension: "", agent_name: "" });
    if (extensions === null) {
      void fetchExtensions();
    }
  }

  async function handleAddExtension() {
    if (!newExt.agent_extension.trim()) {
      toast.error("La extensión es requerida");
      return;
    }
    setAddingExt(true);
    try {
      const res = await fetch(`/api/qac/departments/${dept.id}/extensions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_extension: newExt.agent_extension.trim(),
          agent_name: newExt.agent_name.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Failed to add");
      }
      setNewExt({ agent_extension: "", agent_name: "" });
      toast.success("Extensión agregada");
      void fetchExtensions();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al agregar extensión",
      );
    } finally {
      setAddingExt(false);
    }
  }

  async function handleDeleteExtension(agentExtension: string) {
    if (!confirm(`¿Eliminar extensión "${agentExtension}"?`)) return;
    try {
      const res = await fetch(`/api/qac/departments/${dept.id}/extensions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_extension: agentExtension }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Extensión eliminada");
      void fetchExtensions();
    } catch {
      toast.error("Error al eliminar extensión");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
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
            onClick={toggleExtensions}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
          >
            <Phone className="h-3.5 w-3.5" />
            Extensiones
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => onEdit(dept)}
            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
          >
            Editar
          </button>
          <button
            onClick={() => onToggleActive(dept)}
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
      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-400">
            Extensiones asignadas
          </p>

          {loadingExt && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
            </div>
          )}

          {!loadingExt && (
            <>
              {deptExtensions.length === 0 && (
                <p className="mb-3 text-sm text-gray-400">
                  Sin extensiones asignadas. Las llamadas se detectan por{" "}
                  <code className="text-xs text-gray-500">agent_type</code> del
                  proveedor.
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
                          void handleDeleteExtension(ext.agent_extension)
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
                    setNewExt((p) => ({
                      ...p,
                      agent_extension: e.target.value,
                    }))
                  }
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <input
                  type="text"
                  placeholder="Nombre (opcional)"
                  value={newExt.agent_name}
                  onChange={(e) =>
                    setNewExt((p) => ({
                      ...p,
                      agent_name: e.target.value,
                    }))
                  }
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <button
                  onClick={() => void handleAddExtension()}
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
}
