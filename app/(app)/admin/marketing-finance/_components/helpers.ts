/** Date/format helpers, presets, and shared types for marketing-finance. */
import type { FinanceRow } from "@/app/api/marketing-finance/route";

export function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function today() {
  return toISO(new Date());
}
export function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
}
export function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  return toISO(d);
}
export function startOfLastMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return toISO(d);
}
export function endOfLastMonth() {
  const d = new Date();
  d.setDate(0);
  return toISO(d);
}

export const PRESETS = [
  { label: "Hoy", from: () => today(), to: () => today() },
  { label: "Ayer", from: () => daysAgo(1), to: () => daysAgo(1) },
  { label: "Últ. 7 días", from: () => daysAgo(6), to: () => today() },
  { label: "Últ. 30 días", from: () => daysAgo(29), to: () => today() },
  { label: "Este mes", from: () => startOfMonth(), to: () => today() },
  {
    label: "Mes anterior",
    from: () => startOfLastMonth(),
    to: () => endOfLastMonth(),
  },
];

// ── Formatters ────────────────────────────────────────────────────────────────
export function fmt$(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}
export function fmtNum(n: number) {
  return n.toLocaleString("en-US");
}

export type SortKey = keyof Pick<
  FinanceRow,
  | "campaign"
  | "subsource"
  | "country"
  | "leads"
  | "ftds"
  | "cr_pct"
  | "cpa_total"
>;
export type SortDir = "asc" | "desc";

export interface PriceRow {
  id: string;
  campaign: string;
  country: string;
  price: number;
  notes: string | null;
  updated_at: string;
}
