/**
 * CallLifecycleManager — tracks granular call state and persists to Supabase.
 *
 * Two orthogonal axes:
 *   technical_status — SIP/media-layer state (initiated → in_progress → completed)
 *   business_outcome — sales/ops result   (voicemail, dnc, silence_timeout …)
 *
 * All writes are best-effort: errors are logged but never thrown, so a DB
 * hiccup can never crash the call or block the audio pipeline.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type TechnicalStatus =
  | "initiated"
  | "ringing"
  | "in_progress"
  | "completed"
  | "failed"
  | "no_answer"
  | "busy"
  | "cancelled";

export type BusinessOutcome =
  | "voicemail"
  | "contacted"
  | "interested"
  | "not_interested"
  | "dnc"
  | "transferred"
  | "silence_timeout"
  | "error";

// Legacy status values used by the existing UI (backwards compat mapping)
const TECH_TO_LEGACY: Record<TechnicalStatus, string> = {
  initiated: "initiated",
  ringing: "ringing",
  in_progress: "in-progress",
  completed: "completed",
  failed: "failed",
  no_answer: "no_answer",
  busy: "failed",
  cancelled: "cancelled",
};

const TERMINAL_STATUSES = new Set<TechnicalStatus>([
  "completed",
  "failed",
  "no_answer",
  "busy",
  "cancelled",
]);

export class CallLifecycleManager {
  private _status: TechnicalStatus = "initiated";
  private _outcome: BusinessOutcome | null = null;
  private _endReason: string | null = null;
  private _answeredAt: Date | null = null;
  private _endedAt: Date | null = null;
  private _closed = false;

  constructor(
    private readonly roomName: string,
    private readonly workspaceId: string,
    private readonly supabase: SupabaseClient,
  ) {}

  get status(): TechnicalStatus {
    return this._status;
  }
  get outcome(): BusinessOutcome | null {
    return this._outcome;
  }
  get endReason(): string | null {
    return this._endReason;
  }
  get answeredAt(): Date | null {
    return this._answeredAt;
  }
  get endedAt(): Date | null {
    return this._endedAt;
  }

  /** Record that a real human answered (first meaningful user speech). */
  markAnswered(): void {
    if (!this._answeredAt) this._answeredAt = new Date();
    if (this._status === "ringing" || this._status === "initiated") {
      this._status = "in_progress";
      void this._persist();
    }
  }

  /** Override the business outcome (can be called multiple times; last write wins). */
  setOutcome(outcome: BusinessOutcome): void {
    this._outcome = outcome;
  }

  /**
   * Transition to a new technical status and optionally set an end reason.
   * Automatically stamps `ended_at` for terminal statuses.
   */
  async transitionTo(status: TechnicalStatus, reason?: string): Promise<void> {
    this._status = status;
    if (reason) this._endReason = reason;
    if (TERMINAL_STATUSES.has(status)) {
      this._endedAt = this._endedAt ?? new Date();
    }
    await this._persist();
  }

  /**
   * Called once at Close time. Idempotent — subsequent calls are no-ops.
   * Derives final status/outcome from what was set during the call.
   */
  async finalize(opts: {
    voicemailDetected: boolean;
    durationSeconds: number;
  }): Promise<void> {
    if (this._closed) return;
    this._closed = true;

    this._endedAt = this._endedAt ?? new Date();

    // Only upgrade status if not already terminal
    if (!TERMINAL_STATUSES.has(this._status)) {
      // Voicemail means the person never answered → no_answer, not completed
      this._status = opts.voicemailDetected ? "no_answer" : "completed";
    }

    // Derive business_outcome from voicemail detection if not explicitly set
    if (!this._outcome) {
      if (opts.voicemailDetected) {
        this._outcome = "voicemail";
      } else if (this._status === "no_answer") {
        this._outcome = "not_interested";
      } else if (this._status === "completed" && opts.durationSeconds > 5) {
        this._outcome = "contacted";
      }
    }

    await this._persist();
  }

  private async _persist(): Promise<void> {
    const patch: Record<string, unknown> = {
      technical_status: this._status,
      // Keep legacy status in sync so existing UI code never breaks
      status: TECH_TO_LEGACY[this._status] ?? this._status,
    };
    if (this._outcome !== null) patch.business_outcome = this._outcome;
    if (this._endReason !== null) patch.end_reason = this._endReason;
    if (this._answeredAt !== null)
      patch.answered_at = this._answeredAt.toISOString();
    if (this._endedAt !== null) patch.ended_at = this._endedAt.toISOString();

    try {
      const { error } = await this.supabase
        .from("calls")
        .update(patch)
        .eq("retell_call_id", this.roomName);
      if (error) {
        console.error("[lifecycle] persist failed:", error.message);
      }
    } catch (err) {
      console.error("[lifecycle] persist error:", String(err));
    }
  }
}
