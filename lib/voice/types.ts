// Shared TypeScript types for the voice agent infrastructure.
// These mirror the database schema and the Go orchestrator's wire format.

export type CallStatus = 'active' | 'completed' | 'failed'
export type CallDirection = 'inbound' | 'outbound'
export type AgentState = 'LISTENING' | 'THINKING' | 'SPEAKING'
export type SentimentLabel = 'positive' | 'neutral' | 'negative'
export type CallOutcome = 'conversion' | 'ftd' | 'no_sale' | 'callback' | 'unknown'

export interface VoiceAgent {
  id: string
  name: string
  ownerApiKey: string
  systemPrompt?: string
  llmModel: string
  sttModel: string
  ttsProvider: string
  ttsVoiceId?: string
  language: string
  silenceTimeoutMs: number
  maxCallDurationS: number
  webhookUrl?: string
  pineconeIndex?: string
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface VoiceCall {
  id: string
  agentId: string
  callerNumber?: string
  direction: CallDirection
  sipCallId?: string
  status: CallStatus
  startedAt: string
  endedAt?: string
  durationS?: number
  bargeInCount: number
  turnCount: number
  metadata?: Record<string, unknown>
}

export interface TurnMetric {
  id: string
  callId: string
  turnId: string
  endOfSpeechAt: string
  firstTokenAt?: string
  firstAudioAt?: string
  ttfbMs?: number
  llmLatencyMs?: number
  ttsLatencyMs?: number
  sttConfidence?: number
}

export interface CallTranscript {
  id: string
  callId: string
  turns: TranscriptTurn[]
  rawText: string
  createdAt: string
}

export interface TranscriptTurn {
  role: 'user' | 'assistant' | 'system'
  content: string
  ts?: string
}

export interface CallAnalysis {
  id: string
  callId: string
  sentimentScore?: number   // 1–10
  sentimentLabel?: SentimentLabel
  outcome?: CallOutcome
  entities?: {
    names?: string[]
    dates?: string[]
    amounts?: string[]
    phoneNumbers?: string[]
    emails?: string[]
    [key: string]: unknown
  }
  objections?: string[]
  nextAction?: string
  summary?: string
  confidence?: number
  modelVersion?: string
  processedAt: string
}

// ── Dashboard API response shapes ─────────────────────────────────────────────

export interface DashboardStats {
  activeCalls: number
  callsToday: number
  avgTtfbMs: number
  p95TtfbMs: number
  bargeInRate: number            // % of turns with barge-in
  conversionRate: number         // % of completed calls → conversion
  sentimentAvg: number           // avg sentiment score 1-10
}

export interface LatencyBucket {
  bucket: string                  // ISO timestamp
  agentId: string
  turns: number
  p50Ms: number
  p95Ms: number
  p99Ms: number
  avgMs: number
}

export interface AgentAnalyticsSummary {
  agentId: string
  agentName: string
  totalCalls: number
  avgDurationS: number
  p95TtfbMs: number
  conversionRate: number
  sentimentAvg: number
  bargeInRate: number
}

// ── WebSocket wire protocol ───────────────────────────────────────────────────

export type WsMessageType =
  | 'audio_chunk'
  | 'transcript'
  | 'agent_speech'
  | 'state_change'
  | 'barge_in'
  | 'function_call'
  | 'function_result'
  | 'call_end'

export interface WsMessage<T = unknown> {
  type: WsMessageType
  payload?: T
}

export interface AudioChunkPayload {
  pcm: Uint8Array
}

export interface TranscriptPayload {
  turnId: string
  text: string
  final: boolean
  confidence?: number
}

export interface StateChangePayload {
  state: AgentState
  timestamp: string
}

export interface FunctionCallPayload {
  name: string
  arguments: Record<string, unknown>
  callId: string
}

export interface FunctionResultPayload {
  callId: string
  name: string
  result: string
}

// ── Post-call analysis request ────────────────────────────────────────────────

export interface PostCallAnalysisRequest {
  callId: string
  transcript: TranscriptTurn[]
  agentId: string
}

export interface PostCallAnalysisResult {
  sentimentScore: number
  sentimentLabel: SentimentLabel
  outcome: CallOutcome
  entities: CallAnalysis['entities']
  objections: string[]
  nextAction: string
  summary: string
}
