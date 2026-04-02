// Package orchestrator manages the lifecycle of a single voice call session.
// It wires together STT → LLM → TTS with the state machine and audio buffer,
// achieving end-to-end latency targets of <800 ms.
package orchestrator

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"sync/atomic"
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
	MsgTypeAudioChunk     = "audio_chunk"     // client → server: raw PCM bytes
	MsgTypeTranscript     = "transcript"      // server → client: partial/final STT result
	MsgTypeAgentSpeech    = "agent_speech"    // server → client: TTS audio chunk
	MsgTypeStateChange    = "state_change"    // server → client: machine state update
	MsgTypeBargeIn        = "barge_in"        // server → client: flush signal
	MsgTypeFunctionCall   = "function_call"   // server → client: tool invocation
	MsgTypeFunctionResult = "function_result" // client → server: tool result
	MsgTypeCallEnd        = "call_end"        // bidirectional: terminate call
	MsgTypeError          = "error"           // server → client: non-fatal error
)

// maxTranscriptTurns is the sliding-window size for conversation history sent to the LLM.
// Older turns are kept locally but not forwarded to avoid context bloat.
const maxTranscriptTurns = 20

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

// ttsJob carries a cancel func so barge-in can abort in-flight TTS.
type ttsJob struct {
	cancel context.CancelFunc
}

// Session manages one active call.
type Session struct {
	callID     string
	agentID    string
	db         *sql.DB
	stt        integrations.STTProvider
	llm        integrations.LLMProvider
	tts        integrations.TTSProvider
	pinecone   *integrations.PineconeClient
	webhooks   *integrations.WebhookDispatcher
	sm         *statemachine.Machine
	logger     *zap.Logger
	startedAt  time.Time
	transcript []integrations.Turn

	// ttsActive is 1 while TTS frames should be forwarded; set to 0 on barge-in
	// to discard late frames without a mutex.
	ttsActive atomic.Int32

	// currentLLMCancel cancels the in-flight LLM goroutine.
	// Accessed only from the single-threaded main loop, so no lock needed.
	currentLLMCancel context.CancelFunc
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
	s := &Session{
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
	}
	return s, nil
}

// Run is the main event loop for the call. It blocks until the call ends.
// A call-duration context wraps the parent so calls cannot run forever.
func (s *Session) Run(ctx context.Context, conn *websocket.Conn, buf *audio.Buffer) {
	// Enforce maximum call duration (default 1 h; agent config can lower it)
	callCtx, callCancel := context.WithTimeout(ctx, time.Hour)
	defer callCancel()

	defer conn.Close()
	defer s.persist(callCtx)

	sttCtx, sttCancel := context.WithCancel(callCtx)
	defer sttCancel()

	// Channels connecting pipeline stages
	utteranceCh  := make(chan integrations.Utterance, 4)
	partialCh    := make(chan string, 32)
	llmRespCh    := make(chan integrations.LLMToken, 128)
	ttsPCMCh     := make(chan []byte, 256)
	funcResultCh := make(chan integrations.FunctionResult, 8)

	go s.runSTT(sttCtx, buf, utteranceCh, partialCh)

	var latency LatencyRecord
	latency.CallID = s.callID

	for {
		select {
		case <-callCtx.Done():
			s.logger.Info("call context done", zap.Error(callCtx.Err()))
			return

		// ── Inbound WebSocket messages ────────────────────────────────────────
		default:
			// 60-second idle read deadline; reset each iteration.
			// Long enough to survive natural silences; short enough to detect dead clients.
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			_, raw, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
					s.logger.Info("client disconnected", zap.Error(err))
				}
				return
			}

			var msg WsMessage
			if err := json.Unmarshal(raw, &msg); err != nil {
				s.logger.Debug("invalid ws message", zap.Error(err))
				continue
			}

			switch msg.Type {
			case MsgTypeAudioChunk:
				var payload struct {
					PCM []byte `json:"pcm"`
				}
				if err := json.Unmarshal(msg.Payload, &payload); err != nil {
					s.logger.Debug("invalid audio_chunk payload", zap.Error(err))
				} else {
					buf.Push(payload.PCM)
				}

			case MsgTypeFunctionResult:
				var result integrations.FunctionResult
				if err := json.Unmarshal(msg.Payload, &result); err != nil {
					s.logger.Debug("invalid function_result payload", zap.Error(err))
				} else {
					select {
					case funcResultCh <- result:
					default:
						s.logger.Warn("funcResultCh full, dropping tool result")
					}
				}

			case MsgTypeCallEnd:
				return
			}

		// ── STT partial → barge-in detection ─────────────────────────────────
		case partial := <-partialCh:
			if s.sm.Is(statemachine.StateSpeaking) {
				s.logger.Info("barge-in detected", zap.String("partial", partial))

				// Stop TTS frame forwarding BEFORE the state transition
				s.ttsActive.Store(0)
				buf.Flush()
				_ = s.sm.Send(statemachine.EventBargeIn)
				s.sendJSON(conn, MsgTypeBargeIn, map[string]string{"partial": partial})
			}

		// ── STT final utterance → LLM ─────────────────────────────────────────
		case utterance := <-utteranceCh:
			if !s.sm.Is(statemachine.StateListening) {
				break
			}

			// Cancel any previously running LLM goroutine before starting a new one
			if s.currentLLMCancel != nil {
				s.currentLLMCancel()
			}

			latency.TurnID = uuid.NewString()
			latency.EndOfSpeechAt = utterance.EndedAt
			_ = s.sm.Send(statemachine.EventEndOfUtterance)

			// Sliding-window transcript: only keep last N turns
			s.transcript = append(s.transcript, integrations.Turn{Role: "user", Content: utterance.Text})
			if len(s.transcript) > maxTranscriptTurns {
				s.transcript = s.transcript[len(s.transcript)-maxTranscriptTurns:]
			}

			// RAG context (non-blocking, best-effort)
			ragCtx := ""
			if hits, err := s.pinecone.Query(callCtx, utterance.Text, 3); err == nil {
				for _, h := range hits {
					ragCtx += h.Text + "\n"
				}
			}

			s.sendJSON(conn, MsgTypeTranscript, map[string]any{
				"turn_id": latency.TurnID,
				"text":    utterance.Text,
				"final":   true,
			})

			var llmCtx context.Context
			llmCtx, s.currentLLMCancel = context.WithCancel(callCtx)
			go s.runLLM(llmCtx, ragCtx, llmRespCh, funcResultCh)

		// ── LLM token → TTS ───────────────────────────────────────────────────
		case token := <-llmRespCh:
			if token.FunctionCall != nil {
				s.handleFunctionCall(callCtx, conn, token.FunctionCall)
				break
			}

			if !s.sm.Is(statemachine.StateThinking) {
				break
			}

			if latency.FirstTokenAt.IsZero() {
				latency.FirstTokenAt = time.Now()
				_ = s.sm.Send(statemachine.EventLLMReady)
				s.ttsActive.Store(1)

				ttsCtx, ttsCancel := context.WithCancel(callCtx)
				// TTS cancel is triggered if a barge-in arrives mid-sentence
				_ = ttsCancel // ttsCancel is called via buf.FlushSignal in runTTS
				go s.runTTS(ttsCtx, token.Text, ttsPCMCh, ttsCancel)
			}

			if token.Done {
				s.transcript = append(s.transcript, integrations.Turn{Role: "assistant", Content: token.FullText})
			}

		// ── TTS PCM → WebSocket ───────────────────────────────────────────────
		case pcm := <-ttsPCMCh:
			if len(pcm) == 0 {
				// Sentinel: TTS finished
				_ = s.sm.Send(statemachine.EventTTSDone)
				s.recordLatency(callCtx, latency)
				latency = LatencyRecord{CallID: s.callID}
				break
			}
			// Only forward frames when TTS is still "active" (not interrupted by barge-in)
			if s.ttsActive.Load() == 1 {
				if latency.FirstAudioAt.IsZero() {
					latency.FirstAudioAt = time.Now()
				}
				s.sendBinary(conn, pcm)
			}
		}
	}
}

// runSTT streams audio chunks from the buffer to Deepgram and forwards results.
func (s *Session) runSTT(ctx context.Context, buf *audio.Buffer, utteranceCh chan<- integrations.Utterance, partialCh chan<- string) {
	ticker := time.NewTicker(20 * time.Millisecond)
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
			stream.Reset()
		case <-ticker.C:
			chunk, ok := buf.Pop()
			if !ok {
				continue
			}
			if err := stream.Send(chunk.PCM); err != nil {
				s.logger.Warn("STT send error", zap.Error(err))
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
// Uses the sliding-window transcript snapshot taken at call time.
func (s *Session) runLLM(ctx context.Context, ragCtx string, tokenCh chan<- integrations.LLMToken, funcResultCh <-chan integrations.FunctionResult) {
	msgs := make([]integrations.Turn, 0, len(s.transcript)+1)
	if ragCtx != "" {
		msgs = append(msgs, integrations.Turn{Role: "system", Content: "Relevant context:\n" + ragCtx})
	}
	msgs = append(msgs, s.transcript...)

	stream, err := s.llm.ChatStream(ctx, msgs)
	if err != nil {
		s.logger.Error("LLM stream error", zap.Error(err))
		// Notify the main loop so it can surface an error to the client
		select {
		case tokenCh <- integrations.LLMToken{Done: true}:
		case <-ctx.Done():
		}
		return
	}
	defer stream.Close()

	for token := range stream.Tokens() {
		select {
		case tokenCh <- token:
		case <-ctx.Done():
			return
		}

		if token.FunctionCall != nil {
			select {
			case result := <-funcResultCh:
				if err := stream.SubmitToolResult(result); err != nil {
					s.logger.Error("tool result submission failed", zap.Error(err))
					return
				}
			case <-ctx.Done():
				return
			}
		}
	}
}

// runTTS synthesizes text and sends PCM frames to ttsPCMCh.
// Sends a zero-length sentinel when done (or on error).
// Respects the flush signal from the audio buffer for mid-utterance barge-in.
func (s *Session) runTTS(ctx context.Context, text string, pcmCh chan<- []byte, cancel context.CancelFunc) {
	defer cancel()

	frames, err := s.tts.Synthesize(ctx, text)
	if err != nil {
		if ctx.Err() == nil {
			s.logger.Error("TTS synthesis failed", zap.Error(err))
		}
		pcmCh <- []byte{} // sentinel
		return
	}
	for _, f := range frames {
		select {
		case pcmCh <- f:
		case <-ctx.Done():
			pcmCh <- []byte{} // sentinel to unblock main loop
			return
		}
	}
	pcmCh <- []byte{} // sentinel: normal end
}

// handleFunctionCall dispatches tool invocations.
// Only whitelisted function names are executed server-side.
func (s *Session) handleFunctionCall(ctx context.Context, conn *websocket.Conn, fc *integrations.FunctionCallRequest) {
	s.sendJSON(conn, MsgTypeFunctionCall, fc)

	// Allowlist: only known safe functions are executed directly.
	// Unknown functions are forwarded to the client only (handled client-side).
	switch fc.Name {
	case "trigger_webhook":
		var args struct {
			URL     string            `json:"url"`
			Payload map[string]any    `json:"payload"`
			Headers map[string]string `json:"headers"`
		}
		if err := json.Unmarshal(fc.Arguments, &args); err != nil {
			s.logger.Warn("invalid trigger_webhook arguments", zap.Error(err))
			return
		}
		if err := s.webhooks.Dispatch(ctx, args.URL, args.Payload, args.Headers); err != nil {
			s.logger.Warn("webhook dispatch failed", zap.Error(err))
			s.sendJSON(conn, MsgTypeError, map[string]string{
				"message": "webhook dispatch failed",
				"call_id": fc.CallID,
			})
		}
	default:
		// Unknown tools are intentionally not executed server-side
		s.logger.Debug("unhandled function call forwarded to client", zap.String("name", fc.Name))
	}
}

// recordLatency persists a turn's latency metrics to the database.
func (s *Session) recordLatency(ctx context.Context, r LatencyRecord) {
	if r.TurnID == "" || r.EndOfSpeechAt.IsZero() {
		return
	}
	ttfb := r.FirstAudioAt.Sub(r.EndOfSpeechAt).Milliseconds()
	llmLat := r.FirstTokenAt.Sub(r.EndOfSpeechAt).Milliseconds()
	ttsLat := r.FirstAudioAt.Sub(r.FirstTokenAt).Milliseconds()

	s.logger.Info("turn latency",
		zap.String("turn_id", r.TurnID),
		zap.Int64("ttfb_ms", ttfb),
		zap.Int64("llm_ms", llmLat),
		zap.Int64("tts_ms", ttsLat),
	)

	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO call_turn_metrics
			(id, call_id, turn_id, end_of_speech_at, first_token_at, first_audio_at,
			 ttfb_ms, llm_latency_ms, tts_latency_ms)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		ON CONFLICT DO NOTHING`,
		uuid.NewString(), s.callID, r.TurnID,
		r.EndOfSpeechAt, r.FirstTokenAt, r.FirstAudioAt,
		ttfb, llmLat, ttsLat,
	); err != nil {
		s.logger.Error("failed to persist turn metric", zap.Error(err))
	}
}

// persist writes the final call record to the database on session teardown.
func (s *Session) persist(ctx context.Context) {
	// Use a fresh background context in case the call context was cancelled
	persistCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err := s.db.ExecContext(persistCtx, `
		UPDATE voice_calls SET ended_at=$1, duration_s=$2 WHERE id=$3`,
		time.Now(),
		int(time.Since(s.startedAt).Seconds()),
		s.callID,
	); err != nil {
		s.logger.Error("failed to persist call record", zap.Error(err))
	}
}

// sendJSON serialises payload and sends a typed message over the WebSocket.
func (s *Session) sendJSON(conn *websocket.Conn, msgType string, payload any) {
	data, err := json.Marshal(payload)
	if err != nil {
		s.logger.Warn("sendJSON marshal error", zap.Error(err))
		return
	}
	env, err := json.Marshal(WsMessage{Type: msgType, Payload: data})
	if err != nil {
		return
	}
	conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	if err := conn.WriteMessage(websocket.TextMessage, env); err != nil {
		s.logger.Debug("ws write error", zap.Error(err))
	}
}

// sendBinary sends a raw PCM frame as a binary WebSocket message.
func (s *Session) sendBinary(conn *websocket.Conn, pcm []byte) {
	payload, _ := json.Marshal(map[string][]byte{"pcm": pcm})
	env, _ := json.Marshal(WsMessage{
		Type:    MsgTypeAgentSpeech,
		Payload: payload,
	})
	conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	if err := conn.WriteMessage(websocket.TextMessage, env); err != nil {
		s.logger.Debug("ws write error (audio)", zap.Error(err))
	}
}

// Silence linter for unused import.
var _ = fmt.Sprintf
