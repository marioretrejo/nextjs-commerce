// Package integrations defines the provider interfaces and shared types used
// by all third-party service adapters (STT, LLM, TTS, vector DB, webhooks).
package integrations

import (
	"context"
	"encoding/json"
	"time"
)

// ── STT ──────────────────────────────────────────────────────────────────────

// STTProvider is the interface every Speech-to-Text adapter must implement.
type STTProvider interface {
	// OpenStream opens a new duplex streaming session.
	OpenStream(ctx context.Context) (STTStream, error)
}

// STTStream represents an active STT streaming session.
type STTStream interface {
	// Send writes a raw PCM chunk to the stream.
	Send(pcm []byte) error
	// Results returns the channel on which transcription events are published.
	Results() <-chan STTResult
	// Reset clears mid-utterance state (called on barge-in).
	Reset()
	// Close terminates the stream.
	Close()
}

// STTResult is a single transcription event from the STT provider.
type STTResult struct {
	Transcript string
	IsFinal    bool
	Confidence float64
	Timestamp  time.Time
}

// Utterance is a complete user turn produced after the STT signals EndOfUtterance.
type Utterance struct {
	Text    string
	EndedAt time.Time
}

// ── LLM ──────────────────────────────────────────────────────────────────────

// Turn is a single conversational message.
type Turn struct {
	Role    string `json:"role"`    // "user" | "assistant" | "system" | "tool"
	Content string `json:"content"`
	Name    string `json:"name,omitempty"` // tool name when role == "tool"
}

// LLMProvider is the interface every LLM adapter must implement.
type LLMProvider interface {
	// ChatStream starts a streaming completion given a conversation history.
	ChatStream(ctx context.Context, messages []Turn) (LLMStream, error)
}

// LLMStream represents an active LLM streaming session.
type LLMStream interface {
	// Tokens returns a channel of incremental LLM responses.
	Tokens() <-chan LLMToken
	// SubmitToolResult injects a function/tool result back into the stream.
	SubmitToolResult(result FunctionResult) error
	// Close terminates the stream.
	Close()
}

// LLMToken is one streaming chunk from the LLM.
type LLMToken struct {
	Text         string
	FullText     string // cumulative text so far
	Done         bool
	FunctionCall *FunctionCallRequest
}

// FunctionCallRequest is emitted by the LLM when it wants to invoke a tool.
type FunctionCallRequest struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
	CallID    string          `json:"call_id"`
}

// FunctionResult is the client-side result of a tool invocation.
type FunctionResult struct {
	CallID string `json:"call_id"`
	Name   string `json:"name"`
	Result string `json:"result"`
}

// ── TTS ──────────────────────────────────────────────────────────────────────

// TTSProvider is the interface every Text-to-Speech adapter must implement.
type TTSProvider interface {
	// Synthesize converts text into a slice of PCM audio frames.
	// Returns frames ordered for sequential playback.
	Synthesize(ctx context.Context, text string) ([][]byte, error)
}

// ── Vector DB ─────────────────────────────────────────────────────────────────

// VectorHit is a single nearest-neighbour result from a vector DB query.
type VectorHit struct {
	ID    string
	Score float64
	Text  string
}
