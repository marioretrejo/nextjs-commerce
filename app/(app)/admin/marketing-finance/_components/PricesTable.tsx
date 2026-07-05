"use client";

import type { Dispatch, SetStateAction } from "react";
import { Check, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { fmt$, type PriceRow } from "./helpers";

interface EditData {
  price: string;
  notes: string;
  campaign: string;
  country: string;
}

export function PricesTable({
  prices,
  editId,
  editData,
  setEditData,
  saving,
  deleting,
  startEdit,
  cancelEdit,
  saveEdit,
  deleteRow,
}: {
  prices: PriceRow[];
  editId: string | null;
  editData: EditData;
  setEditData: Dispatch<SetStateAction<EditData>>;
  saving: boolean;
  deleting: string | null;
  startEdit: (row: PriceRow) => void;
  cancelEdit: () => void;
  saveEdit: (id: string) => void;
  deleteRow: (id: string, label: string) => void;
}) {
  const cellCls = "px-3 py-2.5 text-xs";
  const inputCls =
    "w-full rounded border border-[#e0e0e0] bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10";
  return (
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
  );
}
