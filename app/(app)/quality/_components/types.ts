import type { Agent } from "@/lib/supabase/types";

export interface QAWeeklyPoint {
  week: string;
  avg: number;
}

export interface AgentQARow {
  agent: Agent;
  avgScore: number;
  callCount: number;
  belowThreshold: number;
}

export interface CriteriaForm {
  name: string;
  description: string;
  weight: number;
}

export const THRESHOLD = 70;
