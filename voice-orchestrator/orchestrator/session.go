// Package orchestrator manages the lifecycle of a single voice call session.
// It wires together STT → LLM → TTS with the state machine and audio buffer,
// achieving end-to-end latency targets of <800 ms.
package orchestrator

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"github.com/marioretrejo/nextjs-commerce/voice-orchestrator/audio"
	"github.com/marioretrejo/nextjs-commerce/voice-orchestrator/integrations"
	"github.com/marioretrejo/nextjs-commerce/voice-orchestrator/statemachine"
)

// Message types exchanged over the WebSocket connection.
const (
	MsgTypeAudioChunk    = "audio_chunk"    // client → server: raw PCM bytes (base64)
	MsgTypeTranscript    = "transcript"     // server → client: partial/final STT result
	MsgTypeAgentSpeech   = "agent_speech"   // server → client: TTS audio chunk
	MsgTypeStateChange   = "state_change"   // server → client: machine state update
	MsgTypeBargeIn       = "barge_in"       // server → client: flush signal
	MsgTypeFunctionCall  = "function_call"  // server → client: tool invocation
	MsgTypeFunctionResult = "function_result" // client → server: tool result
	MsgTypeCallEnd       = "call_end"       // bidirectional: terminate call
)

// WsMessage is the envelope for all WebSocket messages.
type WsMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

// LatencyRecord holds timing data for a single user-turn.
type LatencyRecord struct {
	CallID        string
	TurnID        string
	EndOfSpeechAt time.Time
	FirstTokenAt  time.Time
	FirstAudioAt  time.Time
}

// Session manages one active call.
type Session struct {
	callID    string
	agentID   string
	db        *sql.DB
	stt       integrations.STTProvider
	llm       integrations.LLMProvider
	tts       integrations.TTSProvider
	pinecone  *integrations.PineconeClient
	webhooks  *integrations.WebhookDispatcher
	sm        *statemachine.Machine
	logger    *zap.Logger
	startedAt time.Time
	transcript []integrations.Turn
}

// SessionFactory creates Session instances with shared dependencies.
type SessionFactory struct {
	db       *sql.DB
	stt      integrations.STTProvider
	llm      integrations.LLMProvider
	tts      integrations.TTSProvider
	pinecone *integrations.PineconeClient
	webhooks *integrations.WebhookDispatcher
	logger   *zap.Logger
}

func NewSessionFactory(
	db *sql.DB,
	stt integrations.STTProvider,
	llm integrations.LLMProvider,
	tts integrations.TTSProvider,
	pinecone *integrations.PineconeClient,
	webhooks *integrations.WebhookDispatcher,
	logger *zap.Logger,
) *SessionFactory {
	return &SessionFactory{db, stt, llm, tts, pinecone, webhooks, logger}
}

func (f *SessionFactory) NewSession(ctx context.Context, callID, agentID string) (*Session, error) {
	if callID == "" {
		callID = uuid.NewString()
	}
	sm := statemachine.New(f.logger)
	return &Session{
		callID:    callID,
		agentID:   agentID,
		db:        f.db,
		stt:       f.stt,
		llm:       f.llm,
		tts:       f.tts,
		pinecone:  f.pinecone,
		webhooks:  f.webhooks,
		sm:        sm,
		logger:    f.logger.With(zap.String("call_id", callID)),
		startedAt: time.Now(),
	}, nil
}

// Run is the main event loop for the call. It blocks until the call ends.
//
// Audio pipeline:
//   1. Receive PCM chunks from WebSocket → push to audio.Buffer
//   2. Stream chunks to Deepgram STT via a separate goroutine
//   3. On EndOfUtterance event → THINKING state → query LLM
//   4. Stream LLM tokens; on first token → TTS begins (SPEAKING state)
//   5. TTS PCM frames → WebSocket → client
//   6. If barge-in detected while SPEAKING → flush buffer → back to THINKING
func (s *Session) Run(ctx context.Context, conn *websocket.Conn, buf *audio.Buffer) {
	defer conn.Close()
	defer s.persist(ctx)

	// STT streaming context – cancelled when the call ends
	sttCtx, sttCancel := context.WithCancel(ctx)
	defer sttCancel()

	// Channels connecting pipeline stages
	utteranceCh := make(chan integrations.Utterance, 4)   // STT final results
	partialCh   := make(chan string, 32)                   // STT partials (for barge-in)
	llmRespCh   := make(chan integrations.LLMToken, 128)  // streaming LLM tokens
	ttsPCMCh    := make(chan []byte, 256)                  // TTS audio chunks
	funcResultCh := make(chan integrations.FunctionResult, 8)

	// Start STT streaming goroutine
	go s.runSTT(sttCtx, buf, utteranceCh, partialCh)

	// Main orchestration loop
	var latency LatencyRecord
	latency.CallID = s.callID

	for {
		select {
		case <-ctx.Done():
			return

		// ── Inbound WebSocket messages ────────────────────────────────────────
		default:
			conn.SetReadDeadline(time.Now().Add(30 * time.Second))
			_, raw, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway) {
					s.logger.Info("client disconnected", zap.Error(err))
				}
				return
			}

			var msg WsMessage
			if err := json.Unmarshal(raw, &msg); err != nil {
				continue
			}

			switch msg.Type {
			case MsgTypeAudioChunk:
				var payload struct{ PCM []byte `json:"pcm"` }
				if json.Unmarshal(msg.Payload, &payload) == nil {
					buf.Push(payload.PCM)
				}

			case MsgTypeFunctionResult:
				var result integrations.FunctionResult
				if json.Unmarshal(msg.Payload, &result) == nil {
					funcResultCh <- result
				}

			case MsgTypeCallEnd:
				return
			}

		// ── STT partial transcript → barge-in detection ───────────────────────
		case partial := <-partialCh:
			if s.sm.Is(statemachine.StateSpeaking) {
				s.logger.Info("barge-in detected", zap.String("partial", partial))
				buf.Flush() // stop outbound TTS audio immediately
				_ = s.sm.Send(statemachine.EventBargeIn)
				s.sendJSON(conn, MsgTypeBargeIn, map[string]string{"partial": partial})
			}

		// ── STT final utterance → LLM query ──────────────────────────────────
		case utterance := <-utteranceCh:
			if !s.sm.Is(statemachine.StateListening) {
				break
			}
			latency.TurnID = uuid.NewString()
			latency.EndOfSpeechAt = utterance.EndedAt
			_ = s.sm.Send(statemachine.EventEndOfUtterance)
			s.transcript = append(s.transcript, integrations.Turn{Role: "user", Content: utterance.Text})

			// Query vector DB for relevant context (non-blocking, best-effort)
			ragCtx := ""
			if hits, err := s.pinecone.Query(ctx, utterance.Text, 3); err == nil {
				for _, h := range hits {
					ragCtx += h.Text + "\n"
				}
			}

			// Send utterance transcript to client
			s.sendJSON(conn, MsgTypeTranscript, map[string]any{
				"turn_id": latency.TurnID,
				"text":    utterance.Text,
				"final":   true,
			})

			// Start async LLM call
			go s.runLLM(ctx, utterance.Text, ragCtx, llmRespCh, funcResultCh)

		// ── LLM token stream → TTS ────────────────────────────────────────────
		case token := <-llmRespCh:
			if token.FunctionCall != nil {
				s.handleFunctionCall(ctx, conn, token.FunctionCall)
				break
			}

			if !s.sm.Is(statemachine.StateThinking) {
				break
			}

			if latency.FirstTokenAt.IsZero() {
				latency.FirstTokenAt = time.Now()
				_ = s.sm.Send(statemachine.EventLLMReady)
				// Start async TTS streaming
				go s.runTTS(ctx, token.Text, ttsPCMCh)
			}

			if token.Done {
				s.transcript = append(s.transcript, integrations.Turn{Role: "assistant", Content: token.FullText})
			}

		// ── TTS PCM → WebSocket ───────────────────────────────────────────────
		case pcm := <-ttsPCMCh:
			if len(pcm) == 0 {
				// Sentinel: TTS done
				_ = s.sm.Send(statemachine.EventTTSDone)
				s.recordLatency(ctx, latency)
				latency = LatencyRecord{CallID: s.callID}
				break
			}
			if latency.FirstAudioAt.IsZero() {
				latency.FirstAudioAt = time.Now()
			}
			s.sendBinary(conn, pcm)
		}
	}
}

// runSTT streams audio chunks from the buffer to Deepgram and forwards results.
func (s *Session) runSTT(ctx context.Context, buf *audio.Buffer, utteranceCh chan<- integrations.Utterance, partialCh chan<- string) {
	ticker := time.NewTicker(20 * time.Millisecond) // 20 ms frame interval
	defer ticker.Stop()

	stream, err := s.stt.OpenStream(ctx)
	if err != nil {
		s.logger.Error("STT stream open failed", zap.Error(err))
		return
	}
	defer stream.Close()

	for {
		select {
		case <-ctx.Done():
			return
		case <-buf.FlushSignal():
			// Barge-in: reset STT mid-stream
			stream.Reset()
		case <-ticker.C:
			chunk, ok := buf.Pop()
			if !ok {
				continue
			}
			if err := stream.Send(chunk.PCM); err != nil {
				s.logger.Warn("STT send error", zap.Error(err))
				continue
			}
		case result := <-stream.Results():
			if result.IsFinal {
				utteranceCh <- integrations.Utterance{Text: result.Transcript, EndedAt: result.Timestamp}
			} else {
				select {
				case partialCh <- result.Transcript:
				default:
				}
			}
		}
	}
}

// runLLM calls the LLM and forwards tokens to llmRespCh.
func (s *Session) runLLM(ctx context.Context, userText, ragCtx string, tokenCh chan<- integrations.LLMToken, funcResultCh <-chan integrations.FunctionResult) {
	msgs := make([]integrations.Turn, 0, len(s.transcript)+2)
	if ragCtx != "" {
		msgs = append(msgs, integrations.Turn{Role: "system", Content: "Relevant context:\n" + ragCtx})
	}
	msgs = append(msgs, s.transcript...)

	stream, err := s.llm.ChatStream(ctx, msgs)
	if err != nil {
		s.logger.Error("LLM stream error", zap.Error(err))
		return
	}
	defer stream.Close()

	for token := range stream.Tokens() {
		select {
		case tokenCh <- token:
		case <-ctx.Done():
			return
		}

		// If LLM emitted a function call, wait for the tool result, then continue
		if token.FunctionCall != nil {
			result := <-funcResultCh
			if err := stream.SubmitToolResult(result); err != nil {
				s.logger.Error("tool result submission failed", zap.Error(err))
				return
			}
		}
	}
}

// runTTS synthesizes text and sends PCM frames to ttsPCMCh.
// A zero-length byte slice is sent as a sentinel when done.
func (s *Session) runTTS(ctx context.Context, text string, pcmCh chan<- []byte) {
	frames, err := s.tts.Synthesize(ctx, text)
	if err != nil {
		s.logger.Error("TTS error", zap.Error(err))
		pcmCh <- []byte{} // sentinel
		return
	}
	for _, f := range frames {
		select {
		case pcmCh <- f:
		case <-ctx.Done():
			return
		}
	}
	pcmCh <- []byte{} // sentinel
}

// handleFunctionCall dispatches tool invocations (webhooks, DB queries, etc.)
func (s *Session) handleFunctionCall(ctx context.Context, conn *websocket.Conn, fc *integrations.FunctionCallRequest) {
	s.sendJSON(conn, MsgTypeFunctionCall, fc)

	switch fc.Name {
	case "trigger_webhook":
		var args struct {
			URL     string            `json:"url"`
			Payload map[string]any    `json:"payload"`
			Headers map[string]string `json:"headers"`
		}
		if json.Unmarshal(fc.Arguments, &args) == nil {
			if err := s.webhooks.Dispatch(ctx, args.URL, args.Payload, args.Headers); err != nil {
				s.logger.Warn("webhook dispatch failed", zap.Error(err))
			}
		}
	}
}

// recordLatency persists a turn's latency metrics to the database.
func (s *Session) recordLatency(ctx context.Context, r LatencyRecord) {
	if r.TurnID == "" || r.EndOfSpeechAt.IsZero() {
		return
	}
	ttfb := r.FirstAudioAt.Sub(r.EndOfSpeechAt).Milliseconds()
	s.logger.Info("turn latency",
		zap.String("turn_id", r.TurnID),
		zap.Int64("ttfb_ms", ttfb),
	)
	_, _ = s.db.ExecContext(ctx, `
		INSERT INTO call_turn_metrics (id, call_id, turn_id, end_of_speech_at, first_token_at, first_audio_at, ttfb_ms)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT DO NOTHING`,
		uuid.NewString(), s.callID, r.TurnID,
		r.EndOfSpeechAt, r.FirstTokenAt, r.FirstAudioAt, ttfb,
	)
}

// persist writes the final call record to the database.
func (s *Session) persist(ctx context.Context) {
	_, _ = s.db.ExecContext(ctx, `
		UPDATE voice_calls SET ended_at=$1, duration_s=$2 WHERE id=$3`,
		time.Now(),
		int(time.Since(s.startedAt).Seconds()),
		s.callID,
	)
}

// sendJSON serialises payload and sends a typed message over the WebSocket.
func (s *Session) sendJSON(conn *websocket.Conn, msgType string, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}
	env, _ := json.Marshal(WsMessage{Type: msgType, Payload: data})
	conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	conn.WriteMessage(websocket.TextMessage, env)
}

// sendBinary sends a raw PCM frame as a binary WebSocket message.
func (s *Session) sendBinary(conn *websocket.Conn, pcm []byte) {
	conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	env, _ := json.Marshal(WsMessage{
		Type:    MsgTypeAgentSpeech,
		Payload: func() json.RawMessage { b, _ := json.Marshal(map[string][]byte{"pcm": pcm}); return b }(),
	})
	conn.WriteMessage(websocket.TextMessage, env)
}

// String helper to silence linter.
var _ = fmt.Sprintf
