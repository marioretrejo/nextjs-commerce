'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  TrendingUp, DollarSign, Users, BarChart2, Target,
  RefreshCw, AlertCircle, Clock, ChevronUp, ChevronDown,
} from 'lucide-react';
import type { FinanceReport, FinanceRow } from '@/app/api/marketing-finance/route';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt$(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}
function fmtNum(n: number) {
  return n.toLocaleString('en-US');
}

type SortKey = 'campaign' | 'country' | 'leads' | 'ftds' | 'cr_pct' | 'cpa_total';
type SortDir = 'asc' | 'desc';

// ── Score pill ────────────────────────────────────────────────────────────────
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

// ── KPI card ──────────────────────────────────────────────────────────────────
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
        <div className="flex items-center gap-1.5">
          <div className="h-px flex-1 bg-[#f0f0f0]" />
          <p className="text-[10px] text-[#c0c0c0] font-medium shrink-0">{sub}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MarketingFinancePage() {
  const [report,   setReport]   = useState<FinanceReport | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [sortKey,  setSortKey]  = useState<SortKey>('cpa_total');
  const [sortDir,  setSortDir]  = useState<SortDir>('desc');

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/marketing-finance');
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

  useEffect(() => { void fetchReport(); }, [fetchReport]);

  // Sort rows
  const sorted: FinanceRow[] = report
    ? [...report.detail].sort((a, b) => {
        const va = a[sortKey] ?? 0;
        const vb = b[sortKey] ?? 0;
        if (typeof va === 'string' && typeof vb === 'string')
          return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortDir === 'asc'
          ? (va as number) - (vb as number)
          : (vb as number) - (va as number);
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

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
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
              <p className="text-xs text-[#b0b0b0] mt-0.5">
                Live data from tracker.machukllc.xyz · CPA report
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void fetchReport()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Cargando…' : 'Actualizar'}
          </Button>
          {scraped && (
            <span className="flex items-center gap-1 text-[10px] text-[#b0b0b0]">
              <Clock className="h-3 w-3" /> {scraped}
            </span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !report && (
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

      {/* KPI row */}
      {report && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <KpiCard label="Total Leads"      value={fmtNum(report.total_leads)}    sub="registros"          icon={Users}      />
            <KpiCard label="Total FTDs"       value={fmtNum(report.total_ftds)}     sub="primeros depósitos" icon={Target}      />
            <KpiCard label="FTD Originales"   value={fmtNum(report.original_ftds)}  sub="con precio CPA"     icon={Target}      />
            <KpiCard label="FTD Duplicados"   value={fmtNum(report.duplicate_ftds)} sub="sin precio CPA"     icon={AlertCircle} />
            <KpiCard label="CPA Total"        value={fmt$(report.total_cpa)}        sub="ingresos totales"   icon={DollarSign}  highlight />
            <KpiCard label="ECPA"             value={fmt$(report.ecpa)}             sub="por FTD original"   icon={BarChart2}   />
          </div>

          {/* Campaign table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Detalle por Campaña / País</CardTitle>
              <CardDescription>
                {report.detail.length} combinaciones · Haz clic en el encabezado para ordenar
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                      {(
                        [
                          { key: 'campaign',   label: 'Campaña',    align: 'text-left'  },
                          { key: 'country',    label: 'País',       align: 'text-left'  },
                          { key: 'leads',      label: 'Leads',      align: 'text-right' },
                          { key: 'ftds',       label: 'FTDs',       align: 'text-right' },
                          { key: 'cr_pct',     label: 'CR%',        align: 'text-right' },
                          { key: null,         label: 'Precio Unit', align: 'text-right' },
                          { key: 'cpa_total',  label: 'CPA Total',  align: 'text-right' },
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
                          No hay datos disponibles
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
                            : <span className="text-[10px] font-semibold text-[#e0b080] bg-orange-50 rounded px-1.5 py-0.5">DUP</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#0a0a0a]">
                          {row.cpa_total > 0 ? fmt$(row.cpa_total) : <span className="text-[#ccc]">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {report.detail.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-[#e8e8e8] bg-[#fafafa] font-semibold">
                        <td className="px-4 py-3 text-[#0a0a0a]" colSpan={2}>TOTALES</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtNum(report.total_leads)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmtNum(report.total_ftds)}</td>
                        <td className="px-4 py-3 text-right">
                          <CrPill pct={report.total_leads > 0 ? Math.round(report.total_ftds / report.total_leads * 1000) / 10 : 0} />
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
