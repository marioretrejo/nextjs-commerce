export type CpaMap = Map<string, number>;

export interface FinanceRow {
  campaign: string;
  subsource: string;
  country: string;
  leads: number;
  ftds: number;
  cr_pct: number;
  unit_price: number | null;
  cpa_total: number;
}

export interface FinanceReport {
  total_leads: number;
  total_ftds: number;
  original_ftds: number;
  duplicate_ftds: number;
  total_cpa: number;
  ecpa: number;
  detail: FinanceRow[];
  scraped_at: string;
  error?: string;
  _debug?: string[];
}
