"use client";

import {
  AlertCircle,
  BarChart2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Target,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import type {
  FinanceReport,
  FinanceRow,
} from "@/app/api/marketing-finance/route";
import {
  fmt$,
  fmtNum,
  type SortKey,
  type SortDir,
  type Totals,
} from "./helpers";
import { CrPill, KpiCard } from "./ui";

export function ReportResults({
  totals,
  dateFrom,
  dateTo,
  isFiltered,
  filterCountry,
  filterSubsource,
  sorted,
  rawReport,
  sortKey,
  sortDir,
  toggleSort,
}: {
  totals: Totals;
  dateFrom: string;
  dateTo: string;
  isFiltered: boolean;
  filterCountry: string;
  filterSubsource: string;
  sorted: FinanceRow[];
  rawReport: FinanceReport | null;
  sortKey: SortKey;
  sortDir: SortDir;
  toggleSort: (k: SortKey) => void;
}) {
  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown className="h-3 w-3 text-[#ccc]" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 text-[#555]" />
    ) : (
      <ChevronDown className="h-3 w-3 text-[#555]" />
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Total Leads"
          value={fmtNum(totals.total_leads)}
          sub="registros"
          icon={Users}
        />
        <KpiCard
          label="Total FTDs"
          value={fmtNum(totals.total_ftds)}
          sub="primeros depósitos"
          icon={Target}
        />
        <KpiCard
          label="FTD Originales"
          value={fmtNum(totals.original_ftds)}
          sub="con precio CPA"
          icon={Target}
        />
        <KpiCard
          label="FTD Duplicados"
          value={fmtNum(totals.duplicate_ftds)}
          sub="sin precio"
          icon={AlertCircle}
        />
        <KpiCard
          label="CPA Total"
          value={fmt$(totals.total_cpa)}
          sub="ingresos por FTDs"
          icon={DollarSign}
          highlight
        />
        <KpiCard
          label="ECPA"
          value={fmt$(totals.ecpa)}
          sub="por FTD original"
          icon={BarChart2}
        />
      </div>

      <div className="rounded-2xl bg-[#0a0a0a] px-6 py-4 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">
            Período
          </p>
          <p className="text-sm font-semibold text-white">
            {dateFrom} → {dateTo}
          </p>
          {isFiltered && (
            <p className="text-[10px] text-white/40 mt-0.5">
              {filterCountry && `🌎 ${filterCountry}`}
              {filterCountry && filterSubsource && " · "}
              {filterSubsource && `📡 ${filterSubsource}`}
            </p>
          )}
        </div>
        <div className="h-8 w-px bg-white/10 hidden sm:block" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">
            FTDs
          </p>
          <p className="text-2xl font-bold text-white">
            {fmtNum(totals.total_ftds)}
          </p>
        </div>
        <div className="h-8 w-px bg-white/10 hidden sm:block" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">
            CPA Total
          </p>
          <p className="text-2xl font-bold text-green-400">
            {fmt$(totals.total_cpa)}
          </p>
        </div>
        <div className="h-8 w-px bg-white/10 hidden sm:block" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">
            ECPA
          </p>
          <p className="text-2xl font-bold text-white">{fmt$(totals.ecpa)}</p>
        </div>
        <div className="h-8 w-px bg-white/10 hidden sm:block" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">
            CR%
          </p>
          <p className="text-2xl font-bold text-white">
            {totals.cr.toFixed(1)}%
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base">
                Detalle por Campaña / Traffic Source / País
              </CardTitle>
              <CardDescription>
                {sorted.length} filas
                {isFiltered
                  ? ` filtradas de ${rawReport!.detail.length}`
                  : ""}{" "}
                · clic en encabezado para ordenar
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                  {(
                    [
                      {
                        key: "campaign",
                        label: "Campaña",
                        align: "text-left",
                      },
                      {
                        key: "subsource",
                        label: "Traffic Source",
                        align: "text-left",
                      },
                      {
                        key: "country",
                        label: "País",
                        align: "text-left",
                      },
                      {
                        key: "leads",
                        label: "Leads",
                        align: "text-right",
                      },
                      {
                        key: "ftds",
                        label: "FTDs",
                        align: "text-right",
                      },
                      {
                        key: "cr_pct",
                        label: "CR%",
                        align: "text-right",
                      },
                      {
                        key: null,
                        label: "Precio Unit",
                        align: "text-right",
                      },
                      {
                        key: "cpa_total",
                        label: "CPA Total",
                        align: "text-right",
                      },
                    ] as {
                      key: SortKey | null;
                      label: string;
                      align: string;
                    }[]
                  ).map(({ key, label, align }) => (
                    <th
                      key={label}
                      onClick={key ? () => toggleSort(key) : undefined}
                      className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] ${align} ${key ? "cursor-pointer hover:text-[#555] select-none" : ""}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {key && <SortIcon k={key} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-sm text-[#9b9b9b]"
                    >
                      No hay datos para los filtros seleccionados
                    </td>
                  </tr>
                )}
                {sorted.map((row, idx) => (
                  <tr
                    key={`${row.campaign}-${row.subsource}-${row.country}-${idx}`}
                    className="border-b border-[#f8f8f8] hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-[#0a0a0a] whitespace-nowrap">
                      {row.campaign || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-[#555] whitespace-nowrap">
                      {row.subsource ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                          {row.subsource}
                        </span>
                      ) : (
                        <span className="text-[#ccc]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[#555] whitespace-nowrap">
                      {row.country || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#555]">
                      {fmtNum(row.leads)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-[#0a0a0a]">
                      {fmtNum(row.ftds)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <CrPill pct={row.cr_pct} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#555]">
                      {row.unit_price !== null ? (
                        fmt$(row.unit_price)
                      ) : (
                        <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">
                          DUP
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#0a0a0a]">
                      {row.cpa_total > 0 ? (
                        fmt$(row.cpa_total)
                      ) : (
                        <span className="text-[#ccc]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {sorted.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-[#e8e8e8] bg-[#fafafa] font-semibold">
                    <td className="px-4 py-3 text-[#0a0a0a]" colSpan={3}>
                      TOTALES
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtNum(totals.total_leads)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtNum(totals.total_ftds)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CrPill pct={totals.cr} />
                    </td>
                    <td className="px-4 py-3 text-right text-[#9b9b9b] text-[11px]">
                      ECPA {fmt$(totals.ecpa)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-green-700 text-base">
                      {fmt$(totals.total_cpa)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
