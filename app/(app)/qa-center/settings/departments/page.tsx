"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Loader2, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import type { Department } from "./_components/types";
import { DepartmentCard } from "./_components/DepartmentCard";
import { DepartmentForm } from "./_components/DepartmentForm";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state: null = closed, { dept } = open (dept null → create)
  const [formState, setFormState] = useState<{
    dept: Department | null;
  } | null>(null);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/qac/departments?include_inactive=true");
      if (!res.ok) throw new Error("Failed to load departments");
      const data = (await res.json()) as { departments: Department[] };
      setDepartments(data.departments ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDepartments();
  }, [fetchDepartments]);

  async function handleToggleActive(dept: Department) {
    try {
      const res = await fetch(`/api/qac/departments/${dept.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !dept.is_active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(
        dept.is_active ? "Departamento desactivado" : "Departamento activado",
      );
      void fetchDepartments();
    } catch {
      toast.error("Error al actualizar el departamento");
    }
  }

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
              <h1 className="text-lg font-semibold text-gray-900">
                Departamentos QA
              </h1>
              <p className="text-sm text-gray-500">
                Configura reglas de análisis por departamento para llamadas VoIP
                externas
              </p>
            </div>
          </div>
          <button
            onClick={() => setFormState({ dept: null })}
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
          Cada departamento configurado aquí controla cómo se analiza
          automáticamente cada llamada recibida desde proveedores VoIP
          (Squaretalk, Twilio, Aircall, etc.). La detección de departamento usa
          el campo{" "}
          <code className="rounded bg-violet-100 px-1 py-0.5 text-xs text-violet-700">
            agent_type
          </code>{" "}
          del proveedor o el mapeo de extensiones a continuación.
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
            <p className="font-medium text-gray-500">
              No hay departamentos configurados
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Crea un departamento para asignar reglas de QA específicas a cada
              equipo.
            </p>
            <button
              onClick={() => setFormState({ dept: null })}
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
            {departments.map((dept) => (
              <DepartmentCard
                key={dept.id}
                dept={dept}
                onEdit={(d) => setFormState({ dept: d })}
                onToggleActive={(d) => void handleToggleActive(d)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {formState && (
        <DepartmentForm
          dept={formState.dept}
          onClose={() => setFormState(null)}
          onSaved={() => {
            setFormState(null);
            void fetchDepartments();
          }}
        />
      )}
    </div>
  );
}
