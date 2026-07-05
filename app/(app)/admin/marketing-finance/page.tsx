"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  DollarSign,
  Users,
  BarChart2,
  Target,
  RefreshCw,
  AlertCircle,
  Clock,
  ChevronUp,
  ChevronDown,
  Calendar,
  Tag,
} from "lucide-react";
import type { FinanceReport } from "@/app/api/marketing-finance/route";

import {
  today,
  startOfMonth,
  PRESETS,
  fmt$,
  fmtNum,
  type SortKey,
  type SortDir,
} from "./_components/helpers";
import { CrPill, KpiCard, SelectFilter } from "./_components/ui";
import { PricesPanel } from "./_components/PricesPanel";

export default function MarketingFinancePage() {
  const [tab, setTab] = useState<"report" | "prices">("report");

  // Date range
  const [dateFrom, setDateFrom] = useState(startOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [activePreset, setActivePreset] = useState("Este mes");

  // Client-side filters
  const [filterCountry, setFilterCountry] = useState("");
  const [filterSubsource, setFilterSubsource] = useState("");

  // Data
  const [rawReport, setRawReport] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // Table sort
  const [sortKey, setSortKey] = useState<SortKey>("cpa_total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Fetch from API ────────────────────────────────────────────────────────
  const fetchReport = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    setFilterCountry("");
    setFilterSubsource("");
    try {
      const res = await fetch(`/api/marketing-finance?from=${from}&to=${to}`);
      let data: FinanceReport;
      try {
        data = (await res.json()) as FinanceReport;
      } catch {
        setError(`Respuesta inválida del servidor (HTTP ${res.status})`);
        return;
      }
      if (data._debug) setDebugLines(data._debug);
      if (!res.ok || data.error) {
        setError(data.error ?? `Error ${res.status}`);
      } else {
        setRawReport(data);
      }
    } catch (e) {
      setError(`Error de red: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport(dateFrom, dateTo);
  }, []); // eslint-disable-line

  function applyPreset(p: (typeof PRESETS)[number]) {
    const f = p.from(),
      t = p.to();
    setDateFrom(f);
    setDateTo(t);
    setActivePreset(p.label);
    void fetchReport(f, t);
  }

  // ── Client-side filter + aggregation ─────────────────────────────────────
  const { filteredRows, totals, countries, subsources } = useMemo(() => {
    if (!rawReport)
      return { filteredRows: [], totals: null, countries: [], subsources: [] };

    const allRows = rawReport.detail;
    const countries = [
      ...new Set(allRows.map((r) => r.country).filter(Boolean)),
    ].sort();
    const subsources = [
      ...new Set(allRows.map((r) => r.subsource).filter(Boolean)),
    ].sort();

    const filtered = allRows.filter(
      (r) =>
        (!filterCountry || r.country === filterCountry) &&
        (!filterSubsource || r.subsource === filterSubsource),
    );

    let totalLeads = 0,
      totalFtds = 0,
      totalCpa = 0,
      dupFtds = 0;
    for (const r of filtered) {
      totalLeads += r.leads;
      totalFtds += r.ftds;
      totalCpa += r.cpa_total;
      if (r.unit_price === null) dupFtds += r.ftds;
    }

    return {
      filteredRows: filtered,
      totals: {
        total_leads: totalLeads,
        total_ftds: totalFtds,
        original_ftds: totalFtds - dupFtds,
        duplicate_ftds: dupFtds,
        total_cpa: Math.round(totalCpa * 100) / 100,
        ecpa:
          totalFtds > 0 ? Math.round((totalCpa / totalFtds) * 100) / 100 : 0,
        cr:
          totalLeads > 0 ? Math.round((totalFtds / totalLeads) * 1000) / 10 : 0,
      },
      countries,
      subsources,
    };
  }, [rawReport, filterCountry, filterSubsource]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = useMemo(
    () =>
      [...filteredRows].sort((a, b) => {
        const va = a[sortKey] ?? 0,
          vb = b[sortKey] ?? 0;
        if (typeof va === "string" && typeof vb === "string")
          return sortDir === "asc"
            ? va.localeCompare(vb)
            : vb.localeCompare(va);
        return sortDir === "asc"
          ? (va as number) - (vb as number)
          : (vb as number) - (va as number);
      }),
    [filteredRows, sortKey, sortDir],
  );

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("desc");
    }
  }
  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown className="h-3 w-3 text-[#ccc]" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 text-[#555]" />
    ) : (
      <ChevronDown className="h-3 w-3 text-[#555]" />
    );
  }

  const scraped = rawReport?.scraped_at
    ? new Date(rawReport.scraped_at).toLocaleString("es-MX", { hour12: false })
    : null;

  const isFiltered = !!(filterCountry || filterSubsource);

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-1">
            Admin
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111] shrink-0">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1
                className="text-2xl font-bold tracking-tight text-[#0a0a0a]"
                style={{ letterSpacing: "-0.02em" }}
              >
                Marketing Finance
              </h1>
              <p className="text-xs text-[#b0b0b0] mt-0.5">
                Live · tracker.machukllc.xyz
              </p>
            </div>
          </div>
        </div>
        {scraped && tab === "report" && (
          <span className="flex items-center gap-1 text-[10px] text-[#b0b0b0] pt-2">
            <Clock className="h-3 w-3" /> {scraped}
          </span>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[#f0f0f0]">
        {(
          [
            { key: "report" as const, label: "Reporte", icon: BarChart2 },
            {
              key: "prices" as const,
              label: "Precios de Afiliados",
              icon: Tag,
            },
          ] as {
            key: "report" | "prices";
            label: string;
            icon: React.ComponentType<{ className?: string }>;
          }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? "border-[#0a0a0a] text-[#0a0a0a]"
                : "border-transparent text-[#9b9b9b] hover:text-[#555]"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Prices Tab ──────────────────────────────────────────────────── */}
      {tab === "prices" && <PricesPanel />}

      {/* ── Report Tab ──────────────────────────────────────────────────── */}
      {tab === "report" && (
        <>
          {/* Filter bar */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      disabled={loading}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border disabled:opacity-50 ${
                        activePreset === p.label
                          ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                          : "bg-white text-[#555] border-[#e8e8e8] hover:border-[#bbb]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="h-6 w-px bg-[#e8e8e8] hidden sm:block" />
                <div className="flex items-center gap-2 flex-wrap">
                  <Calendar className="h-3.5 w-3.5 text-[#b0b0b0] shrink-0" />
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setActivePreset("");
                    }}
                    className="rounded-lg border border-[#e8e8e8] bg-white px-2.5 py-1.5 text-xs text-[#333] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10"
                  />
                  <span className="text-xs text-[#b0b0b0]">→</span>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom}
                    max={today()}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setActivePreset("");
                    }}
                    className="rounded-lg border border-[#e8e8e8] bg-white px-2.5 py-1.5 text-xs text-[#333] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      setActivePreset("");
                      void fetchReport(dateFrom, dateTo);
                    }}
                    disabled={loading || !dateFrom || !dateTo}
                    className="gap-1.5 h-7 px-3 text-xs"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
                    />
                    {loading ? "Cargando…" : "Consultar"}
                  </Button>
                </div>
              </div>

              {rawReport && (
                <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-[#f0f0f0]">
                  <SelectFilter
                    label="País"
                    value={filterCountry}
                    onChange={setFilterCountry}
                    options={countries}
                  />
                  <SelectFilter
                    label="Traffic Source"
                    value={filterSubsource}
                    onChange={setFilterSubsource}
                    options={subsources}
                  />
                  {isFiltered && (
                    <button
                      onClick={() => {
                        setFilterCountry("");
                        setFilterSubsource("");
                      }}
                      className="text-xs text-[#9b9b9b] hover:text-[#555] underline underline-offset-2 pb-1.5"
                    >
                      Limpiar filtros
                    </button>
                  )}
                  {isFiltered && (
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg pb-1.5">
                      Mostrando {sorted.length} de {rawReport.detail.length}{" "}
                      filas
                    </span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Debug panel */}
          {debugLines.length > 0 && (
            <div className="rounded-xl border border-[#e8e8e8] bg-[#fafafa] text-xs">
              <button
                onClick={() => setShowDebug((s) => !s)}
                className="w-full flex items-center justify-between px-4 py-2.5 font-semibold text-[#555] hover:bg-[#f5f5f5] rounded-xl"
              >
                <span>
                  🔍 Debug — Diagnóstico del tracker ({debugLines.length}{" "}
                  líneas)
                </span>
                <span>{showDebug ? "▲" : "▼"}</span>
              </button>
              {showDebug && (
                <pre className="px-4 pb-3 text-[10px] leading-5 text-[#555] overflow-x-auto whitespace-pre-wrap font-mono">
                  {debugLines.join("\n")}
                </pre>
              )}
            </div>
          )}

          {/* Skeleton */}
          {loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-5">
                    <div className="h-3 w-24 bg-[#f0f0f0] rounded animate-pulse mb-3" />
                    <div className="h-8 w-20 bg-[#f0f0f0] rounded animate-pulse mb-2" />
                    <div className="h-2 w-28 bg-[#f5f5f5] rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Results */}
          {!loading && totals && (
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
                  <p className="text-2xl font-bold text-white">
                    {fmt$(totals.ecpa)}
                  </p>
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
                            <td
                              className="px-4 py-3 text-[#0a0a0a]"
                              colSpan={3}
                            >
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
          )}
        </>
      )}
    </div>
  );
}
