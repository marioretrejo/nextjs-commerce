/* ── VoiceOS global types ──────────────────────────────────────────────────
   Expanded per step as each domain module is built.
   ──────────────────────────────────────────────────────────────────────── */

export type Role = 'owner' | 'admin' | 'member' | 'viewer';

export type PlanTier = 'starter' | 'growth' | 'scale' | 'enterprise';

export type AgentStatus = 'draft' | 'active' | 'paused' | 'archived';

export type CallStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'busy';

export type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed';
