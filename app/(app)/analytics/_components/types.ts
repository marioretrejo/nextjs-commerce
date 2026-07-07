export type DateRange = "7d" | "30d" | "90d";

export interface AgentRow {
  id: string;
  name: string;
  calls: number;
  converted: number;
  avgQA: number;
}

export interface DailyBar {
  date: string;
  calls: number;
}

export interface WeeklyLine {
  week: string;
  rate: number;
}

export interface SentimentCounts {
  positive: number;
  neutral: number;
  negative: number;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}
