'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, DollarSign, Users, BarChart2, Target,
  RefreshCw, AlertCircle, Clock, ChevronUp, ChevronDown, Calendar,
} from 'lucide-react';
import type { FinanceReport, FinanceRow } from '@/app/api/marketing-finance/route';

// ── Date helpers ──────────────────────────────────────────────────────────────
function toISO(d: Date) { return d.toISOString().slice(0, 10); }
function today()        { return toISO(new Date()); }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return toISO(d);
}
function startOfMonth() {
  const d = new Date(); d.setDate(1); return toISO(d);
}
function startOfLastMonth() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return toISO(d);
}
function endOfLastMonth() {
  const d = new Date(); d.setDate(0); return toISO(d);
}

const PRESETS = [
  { label: 'Hoy',          from: () => today(),          to: () => today()          },
  { label: 'Ayer',         from: () => daysAgo(1),       to: () => daysAgo(1)       },
  { label: 'Últ. 7 días',  from: () => daysAgo(6),       to: () => today()          },
  { label: 'Últ. 30 días', from: () => daysAgo(29),      to: () => today()          },
  { label: 'Este mes',     from: () => startOfMonth(),   to: () => today()          },
  { label: 'Mes anterior', from: () => startOfLastMonth(), to: () => endOfLastMonth() },
];

// ── Formatters ────────────────────────────────────────────────────────────────
function fmt$(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}
function fmtNum(n: number) { return n.toLocaleString('en-US'); }

type SortKey = 'campaign' | 'country' | 'leads' | 'ftds' | 'cr_pct' | 'cpa_total';
type SortDir = 'asc' | 'desc';

function CrPill({ pct }: { pct: number }) {
  const color =
    pct >= 10 ? 'bg-green-100 text-green-700' :
    pct >= 5  ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-600';
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${color}`}>
      {pct.toFixed(1)}%
    </span>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, highlight,
}: {
  label: string; value: string; sub: string;
  icon: React.ComponentType<{ className?: string }>; highlight?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e0e0e0] to-transparent" />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">{label}</p>
          <Icon className="h-3.5 w-3.5 text-[#d0d0d0]" />
        </div>
        <div className={`text-2xl font-bold mb-1.5 ${highlight ? 'text-green-700' : 'text-[#0a0a0a]'}`}>
          {value}
        </div>
        <p className="text-[10px] text-[#c0c0c0] font-medium">{sub}</p>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MarketingFinancePage() {
  // Date range state — default: this month
  const [dateFrom, setDateFrom] = useState(startOfMonth);
  const [dateTo,   setDateTo]   = useState(today);
  const [activePreset, setActivePreset] = useState('Este mes');

  const [report,  setReport]  = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('cpa_total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchReport = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/marketing-finance?from=${from}&to=${to}`);
      let data: FinanceReport;
      try {
        data = await res.json() as FinanceReport;
      } catch {
        setError(`El servidor devolvió una respuesta inválida (HTTP ${res.status}). Revisa los logs de Vercel.`);
        return;
      }
      if (!res.ok || data.error) {
        setError(data.error ?? `Error del servidor (HTTP ${res.status})`);
      } else {
        setReport(data);
      }
    } catch (e) {
      setError(`Error de red: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount with default dates
  useEffect(() => { void fetchReport(dateFrom, dateTo); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyPreset(p: typeof PRESETS[number]) {
    const f = p.from(), t = p.to();
    setDateFrom(f); setDateTo(t); setActivePreset(p.label);
    void fetchReport(f, t);
  }

  function applyCustom() {
    setActivePreset('');
    void fetchReport(dateFrom, dateTo);
  }

  // Sort rows
  const sorted: FinanceRow[] = report
    ? [...report.detail].sort((a, b) => {
        const va = a[sortKey] ?? 0;
        const vb = b[sortKey] ?? 0;
        if (typeof va === 'string' && typeof vb === 'string')
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
      })
    : [];

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronDown className="h-3 w-3 text-[#ccc]" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 text-[#555]" />
      : <ChevronDown className="h-3 w-3 text-[#555]" />;
  }

  const scraped = report?.scraped_at
    ? new Date(report.scraped_at).toLocaleString('es-MX', { hour12: false })
    : null;

  const totalCR = report && report.total_leads > 0
    ? Math.round(report.total_ftds / report.total_leads * 1000) / 10
    : 0;

  return (
    <div className="p-6 space-y-5 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-1">Admin</p>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111] shrink-0">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]" style={{ letterSpacing: '-0.02em' }}>
                Marketing Finance
              </h1>
              <p className="text-xs text-[#b0b0b0] mt-0.5">Live · tracker.machukllc.xyz</p>
            </div>
          </div>
        </div>

        {scraped && (
          <span className="flex items-center gap-1 text-[10px] text-[#b0b0b0] pt-2">
            <Clock className="h-3 w-3" /> {scraped}
          </span>
        )}
      </div>

      {/* ── Date filter ──────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">

            {/* Preset chips */}
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border ${
                    activePreset === p.label
                      ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                      : 'bg-white text-[#555] border-[#e8e8e8] hover:border-[#bbb]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="h-6 w-px bg-[#e8e8e8] hidden sm:block" />

            {/* Custom date inputs */}
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-[#b0b0b0] shrink-0" />
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={e => { setDateFrom(e.target.value); setActivePreset(''); }}
                className="rounded-lg border border-[#e8e8e8] bg-white px-2.5 py-1.5 text-xs text-[#333] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10"
              />
              <span className="text-xs text-[#b0b0b0]">→</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={today()}
                onChange={e => { setDateTo(e.target.value); setActivePreset(''); }}
                className="rounded-lg border border-[#e8e8e8] bg-white px-2.5 py-1.5 text-xs text-[#333] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/10"
              />
              <Button
                size="sm"
                onClick={applyCustom}
                disabled={loading || !dateFrom || !dateTo}
                className="gap-1.5 h-7 px-3 text-xs"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Cargando…' : 'Consultar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map(i => (
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

      {/* KPIs + Table */}
      {!loading && report && (
        <>
          {/* ── KPI Summary ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Total Leads"    value={fmtNum(report.total_leads)}    sub="registros totales"   icon={Users}      />
            <KpiCard label="Total FTDs"     value={fmtNum(report.total_ftds)}     sub="primeros depósitos"  icon={Target}      />
            <KpiCard label="FTD Originales" value={fmtNum(report.original_ftds)}  sub="con precio CPA"      icon={Target}      />
            <KpiCard label="FTD Duplicados" value={fmtNum(report.duplicate_ftds)} sub="sin precio"          icon={AlertCircle} />
            <KpiCard label="CPA Total"      value={fmt$(report.total_cpa)}        sub="ingresos por FTDs"   icon={DollarSign}  highlight />
            <KpiCard label="ECPA"           value={fmt$(report.ecpa)}             sub="costo por FTD orig." icon={BarChart2}   />
          </div>

          {/* ── Highlight strip ──────────────────────────────────────────── */}
          <div className="rounded-2xl bg-[#0a0a0a] px-6 py-4 flex flex-wrap items-center gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">Período</p>
              <p className="text-sm font-semibold text-white">{dateFrom} → {dateTo}</p>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">FTDs</p>
              <p className="text-2xl font-bold text-white">{fmtNum(report.total_ftds)}</p>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">CPA Total</p>
              <p className="text-2xl font-bold text-green-400">{fmt$(report.total_cpa)}</p>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">ECPA</p>
              <p className="text-2xl font-bold text-white">{fmt$(report.ecpa)}</p>
            </div>
            <div className="h-8 w-px bg-white/10 hidden sm:block" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-0.5">CR%</p>
              <p className="text-2xl font-bold text-white">{totalCR.toFixed(1)}%</p>
            </div>
          </div>

          {/* ── Detail table ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Detalle por Campaña / País</CardTitle>
                  <CardDescription>{report.detail.length} combinaciones · clic en encabezado para ordenar</CardDescription>
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
                          { key: 'campaign',  label: 'Campaña',     align: 'text-left'  },
                          { key: 'country',   label: 'País',        align: 'text-left'  },
                          { key: 'leads',     label: 'Leads',       align: 'text-right' },
                          { key: 'ftds',      label: 'FTDs',        align: 'text-right' },
                          { key: 'cr_pct',    label: 'CR%',         align: 'text-right' },
                          { key: null,        label: 'Precio Unit', align: 'text-right' },
                          { key: 'cpa_total', label: 'CPA Total',   align: 'text-right' },
                        ] as { key: SortKey | null; label: string; align: string }[]
                      ).map(({ key, label, align }) => (
                        <th
                          key={label}
                          onClick={key ? () => toggleSort(key) : undefined}
                          className={`px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] ${align} ${key ? 'cursor-pointer hover:text-[#555] select-none' : ''}`}
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
                        <td colSpan={7} className="py-12 text-center text-sm text-[#9b9b9b]">
                          No hay datos para el período seleccionado
                        </td>
                      </tr>
                    )}
                    {sorted.map((row, idx) => (
                      <tr
                        key={`${row.campaign}-${row.country}-${idx}`}
                        className="border-b border-[#f8f8f8] hover:bg-[#fafafa] transition-colors"
                      >
                        <td className="px-4 py-2.5 font-medium text-[#0a0a0a] whitespace-nowrap">
                          {row.campaign || <span className="text-[#ccc]">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-[#555] whitespace-nowrap">
                          {row.country || <span className="text-[#ccc]">—</span>}
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
                          {row.unit_price !== null
                            ? fmt$(row.unit_price)
                            : <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">DUP</span>
                          }
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#0a0a0a]">
                          {row.cpa_total > 0 ? fmt$(row.cpa_total) : <span className="text-[#ccc]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {sorted.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-[#e8e8e8] bg-[#fafafa] font-semibold">
                        <td className="px-4 py-3 text-[#0a0a0a]" colSpan={2}>TOTALES</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtNum(report.total_leads)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtNum(report.total_ftds)}</td>
                        <td className="px-4 py-3 text-right">
                          <CrPill pct={totalCR} />
                        </td>
                        <td className="px-4 py-3 text-right text-[#9b9b9b] text-[11px]">ECPA {fmt$(report.ecpa)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-green-700 text-base">{fmt$(report.total_cpa)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
