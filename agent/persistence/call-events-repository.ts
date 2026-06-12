/**
 * call-events-repository — fire-and-forget event logger for call lifecycle.
 *
 * Writes one row per event into the `call_events` table (Migration 046).
 * All functions are non-throwing: a Supabase error is swallowed and logged
 * so event recording can never impact the real-time audio pipeline.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type CallEventType =
  // Lifecycle
  | "call.initiated"
  | "call.ringing"
  | "call.answered"
  | "call.in_progress"
  | "call.voicemail_detected"
  | "call.dnc_detected"
  | "call.silence_timeout"
  | "call.transferred"
  | "call.completed"
  | "call.failed"
  | "call.no_answer"
  | "call.cancelled"
  | "call.ended"
  // LLM pipeline
  | "llm.slow"
  | "llm.timeout"
  | "llm.fallback_used"
  // TTS pipeline
  | "tts.first_audio_slow"
  | "tts.first_audio_timeout"
  | "tts.fallback_used"
  | "tts.provider_selected"
  | "tts.provider_constructor_failed"
  | "tts.provider_degraded"
  | "tts.provider_down"
  | "tts.fallback_selected"
  | "tts.fallback_attempted"
  | "tts.fallback_succeeded"
  | "tts.fallback_failed"
  | "tts.fallback_unavailable"
  | "tts.manual_say_failed"
  | "tts.provider_recovered"
  // Watchdogs
  | "watchdog.thinking_phase1"
  | "watchdog.thinking_phase2"
  | "watchdog.thinking_phase3"
  | "watchdog.ttfb_phase1"
  | "watchdog.ttfb_phase2"
  | "watchdog.ttfb_phase3"
  | "watchdog.speaking_fired"
  // Billing
  | "billing.cost_events_backfilled"
  | "billing.preflight_passed"
  | "billing.preflight_failed"
  | "billing.circuit_breaker_triggered"
  // Outbound webhooks
  | "webhook.started"
  | "webhook.sent"
  | "webhook.failed"
  | "webhook.unsigned"
  | "webhook.skipped"
  | "webhook.signature_generated"
  // Dynamic routing
  | "routing.context_resolved"
  | "routing.context_fallback"
  // LLM pipeline (Fase 11)
  | "llm.provider_selected"
  | "llm.provider_constructor_failed"
  | "llm.provider_degraded"
  | "llm.provider_down"
  | "llm.fallback_selected"
  | "llm.fallback_attempted"
  | "llm.fallback_succeeded"
  | "llm.fallback_failed"
  | "llm.runtime_fallback_unavailable"
  | "llm.emergency_response_used"
  // CRM extraction
  | "crm.extraction_started"
  | "crm.extraction_completed"
  | "crm.extraction_failed"
  | "crm.extraction_fallback_used"
  // Post-call jobs (Fase 13)
  | "post_call_jobs.enqueued"
  | "post_call_jobs.enqueue_failed"
  | "post_call_jobs.claimed"
  | "post_call_jobs.completed"
  | "post_call_jobs.failed"
  | "post_call_jobs.retry_scheduled"
  | "post_call_jobs.dead_letter"
  | "post_call_jobs.canceled"
  // QA
  | "qa.started"
  | "qa.completed"
  | "qa.failed"
  // Billing finalization
  | "billing.cost_finalized"
  | "billing.cost_finalization_failed"
  // Campaign lead context (Fase 13)
  | "campaign.lead_context_injected"
  // STT pipeline (Deepgram) — emitted when STT observability is instrumented
  | "stt.provider_selected"
  | "stt.provider_error"
  | "stt.provider_degraded"
  | "stt.provider_down"
  // Telephony (SIP/Twilio) — emitted by dial cron and webhook handlers
  | "telephony.provider_selected"
  | "telephony.sip_participant_created"
  | "telephony.sip_participant_failed"
  | "telephony.status_callback_received"
  | "telephony.status_callback_processed"
  | "telephony.status_callback_failed"
  | "telephony.webhook_validation_failed"
  // Voice Agent Lab — WebRTC/browser session observability
  | "livekit.room_joined"
  | "assistant.speech_started"
  | "assistant.speech_ended";

export async function recordCallEvent(
  supabase: SupabaseClient,
  callRoom: string,
  workspaceId: string,
  eventType: CallEventType,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    const { error } = await supabase.from("call_events").insert({
      call_room: callRoom,
      workspace_id: workspaceId,
      event_type: eventType,
      payload,
    });
    if (error) {
      console.warn("[call-events] insert failed:", error.message, {
        event_type: eventType,
        call_room: callRoom,
      });
    }
  } catch (err) {
    console.warn("[call-events] unexpected error:", String(err));
  }
}

/**
 * Returns a bound recorder so callers don't repeat room/workspace on each call.
 *
 * Usage:
 *   const emit = makeEventRecorder(supabase, roomName, workspaceId);
 *   void emit('call.voicemail_detected', { elapsed_ms: 4500 });
 */
export function makeEventRecorder(
  supabase: SupabaseClient,
  callRoom: string,
  workspaceId: string,
) {
  return (
    eventType: CallEventType,
    payload?: Record<string, unknown>,
  ): void => {
    void recordCallEvent(
      supabase,
      callRoom,
      workspaceId,
      eventType,
      payload ?? {},
    );
  };
}
