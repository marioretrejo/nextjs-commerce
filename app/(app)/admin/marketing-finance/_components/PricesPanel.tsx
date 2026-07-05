"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  Check,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fmt$, type PriceRow } from "./helpers";

export function PricesPanel() {
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    price: string;
    notes: string;
    campaign: string;
    country: string;
  }>({ price: "", notes: "", campaign: "", country: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // New row form
  const [showAdd, setShowAdd] = useState(false);
  const [newRow, setNewRow] = useState({
    campaign: "",
    country: "ALL",
    price: "",
    notes: "",
  });
  const [adding, setAdding] = useState(false);

  const loadPrices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marketing-finance/prices");
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? `Error ${res.status}`);
        return;
      }
      setPrices((await res.json()) as PriceRow[]);
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrices();
  }, [loadPrices]);

  function startEdit(row: PriceRow) {
    setEditId(row.id);
    setEditData({
      price: String(row.price),
      notes: row.notes ?? "",
      campaign: row.campaign,
      country: row.country,
    });
  }
  function cancelEdit() {
    setEditId(null);
  }

  async function saveEdit(id: string) {
    const price = parseFloat(editData.price);
    if (isNaN(price)) {
      toast.error("Precio inválido");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/marketing-finance/prices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price,
          notes: editData.notes,
          campaign: editData.campaign,
          country: editData.country,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Error al guardar");
        return;
      }
      const updated = (await res.json()) as PriceRow;
      setPrices((p) => p.map((r) => (r.id === id ? updated : r)));
      setEditId(null);
      toast.success("Precio actualizado");
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(id: string, label: string) {
    if (!confirm(`¿Eliminar precio de "${label}"?`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/marketing-finance/prices/${id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        toast.error("Error al eliminar");
        return;
      }
      setPrices((p) => p.filter((r) => r.id !== id));
      toast.success("Precio eliminado");
    } catch {
      toast.error("Error de red");
    } finally {
      setDeleting(null);
    }
  }

  async function addRow() {
    const price = parseFloat(newRow.price);
    if (!newRow.campaign.trim()) {
      toast.error("Campaña requerida");
      return;
    }
    if (isNaN(price)) {
      toast.error("Precio inválido");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/marketing-finance/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign: newRow.campaign,
          country: newRow.country || "ALL",
          price,
          notes: newRow.notes,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Error al agregar");
        return;
      }
      const created = (await res.json()) as PriceRow;
      setPrices((p) =>
        [...p, created].sort(
          (a, b) =>
            a.campaign.localeCompare(b.campaign) ||
            a.country.localeCompare(b.country),
        ),
      );
      setNewRow({ campaign: "", country: "ALL", price: "", notes: "" });
      setShowAdd(false);
      toast.success("Precio agregado");
    } catch {
      toast.error("Error de red");
    } finally {
      setAdding(false);
    }
  }

  const cellCls = "px-3 py-2.5 text-xs";
  const inputCls =
    "w-full rounded border border-[#e0e0e0] bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10";

  if (loading)
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-[#f5f5f5] rounded-lg animate-pulse" />
        ))}
      </div>
    );

  if (error)
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
        <AlertCircle className="h-4 w-4 shrink-0" /> {error}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-[#9b9b9b]">
          {prices.length} precios configurados · CPA por campaña y país
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPrices}
            className="gap-1.5 h-7 px-3 text-xs"
          >
            <RefreshCw className="h-3 w-3" /> Recargar
          </Button>
          <Button
            size="sm"
            onClick={() => setShowAdd((s) => !s)}
            className="gap-1.5 h-7 px-3 text-xs"
          >
            <Plus className="h-3 w-3" /> Agregar precio
          </Button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card className="border-dashed border-2 border-[#0a0a0a]/20">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-[#555] mb-3">
              Nuevo precio
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] block mb-1">
                  Campaña *
                </label>
                <input
                  className={inputCls}
                  placeholder="Ej: FAFX"
                  value={newRow.campaign}
                  onChange={(e) =>
                    setNewRow((r) => ({ ...r, campaign: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] block mb-1">
                  País
                </label>
                <input
                  className={inputCls}
                  placeholder="ALL o Argentina"
                  value={newRow.country}
                  onChange={(e) =>
                    setNewRow((r) => ({ ...r, country: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] block mb-1">
                  Precio (USD) *
                </label>
                <input
                  className={inputCls}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="750.00"
                  value={newRow.price}
                  onChange={(e) =>
                    setNewRow((r) => ({ ...r, price: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] block mb-1">
                  Notas
                </label>
                <input
                  className={inputCls}
                  placeholder="Opcional"
                  value={newRow.notes}
                  onChange={(e) =>
                    setNewRow((r) => ({ ...r, notes: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={addRow}
                disabled={adding}
                className="gap-1.5 h-7 px-3 text-xs"
              >
                {adding ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {adding ? "Guardando…" : "Guardar"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdd(false)}
                className="h-7 px-3 text-xs"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  {[
                    "Campaña",
                    "País",
                    "Precio (USD)",
                    "Notas",
                    "Actualizado",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] text-left whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {prices.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-12 text-center text-sm text-[#9b9b9b]"
                    >
                      No hay precios configurados
                    </td>
                  </tr>
                )}
                {prices.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#f8f8f8] hover:bg-[#fafafa] transition-colors"
                  >
                    {editId === row.id ? (
                      <>
                        <td className={cellCls}>
                          <input
                            className={inputCls}
                            value={editData.campaign}
                            onChange={(e) =>
                              setEditData((d) => ({
                                ...d,
                                campaign: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className={cellCls}>
                          <input
                            className={inputCls}
                            value={editData.country}
                            onChange={(e) =>
                              setEditData((d) => ({
                                ...d,
                                country: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className={cellCls}>
                          <input
                            className={`${inputCls} w-28`}
                            type="number"
                            step="0.01"
                            min="0"
                            value={editData.price}
                            onChange={(e) =>
                              setEditData((d) => ({
                                ...d,
                                price: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className={cellCls}>
                          <input
                            className={inputCls}
                            value={editData.notes}
                            onChange={(e) =>
                              setEditData((d) => ({
                                ...d,
                                notes: e.target.value,
                              }))
                            }
                          />
                        </td>
                        <td className={cellCls} />
                        <td className={`${cellCls} text-right`}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => saveEdit(row.id)}
                              disabled={saving}
                              className="p-1 rounded hover:bg-green-100 text-green-700 disabled:opacity-50"
                            >
                              {saving ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 rounded hover:bg-red-100 text-red-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className={`${cellCls} font-medium text-[#0a0a0a]`}>
                          {row.campaign}
                        </td>
                        <td className={cellCls}>
                          {row.country === "ALL" ? (
                            <span className="inline-flex items-center rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                              ALL
                            </span>
                          ) : (
                            <span className="text-[#555]">{row.country}</span>
                          )}
                        </td>
                        <td
                          className={`${cellCls} tabular-nums font-semibold text-green-700`}
                        >
                          {fmt$(row.price)}
                        </td>
                        <td
                          className={`${cellCls} text-[#9b9b9b] max-w-[200px] truncate`}
                        >
                          {row.notes ?? "—"}
                        </td>
                        <td
                          className={`${cellCls} text-[#c0c0c0] whitespace-nowrap`}
                        >
                          {new Date(row.updated_at).toLocaleDateString("es-MX")}
                        </td>
                        <td className={`${cellCls} text-right`}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => startEdit(row)}
                              className="p-1 rounded hover:bg-blue-50 text-[#9b9b9b] hover:text-blue-700"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                deleteRow(
                                  row.id,
                                  `${row.campaign} / ${row.country}`,
                                )
                              }
                              disabled={deleting === row.id}
                              className="p-1 rounded hover:bg-red-50 text-[#9b9b9b] hover:text-red-600 disabled:opacity-50"
                            >
                              {deleting === row.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
