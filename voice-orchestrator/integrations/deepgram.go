// deepgram.go – Deepgram Nova-2 streaming STT adapter.
// Uses Deepgram's WebSocket API for real-time partial and final transcripts.
// Partial transcripts enable barge-in detection without waiting for final results.
package integrations

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

const deepgramWSEndpoint = "wss://api.deepgram.com/v1/listen"

// DeepgramSTT implements STTProvider backed by Deepgram Nova-2.
type DeepgramSTT struct {
	apiKey string
	logger *zap.Logger
}

// NewDeepgramSTT creates a new Deepgram adapter.
func NewDeepgramSTT(apiKey string, logger *zap.Logger) *DeepgramSTT {
	return &DeepgramSTT{apiKey: apiKey, logger: logger}
}

func (d *DeepgramSTT) OpenStream(ctx context.Context) (STTStream, error) {
	params := url.Values{}
	params.Set("model", "nova-2")
	params.Set("encoding", "linear16")
	params.Set("sample_rate", "16000")
	params.Set("channels", "1")
	params.Set("interim_results", "true")
	params.Set("endpointing", "300") // 300 ms of silence → EndOfUtterance
	params.Set("utterance_end_ms", "1000")
	params.Set("language", "en-US")
	params.Set("smart_format", "true")

	wsURL := fmt.Sprintf("%s?%s", deepgramWSEndpoint, params.Encode())
	header := http.Header{"Authorization": {fmt.Sprintf("Token %s", d.apiKey)}}

	conn, _, err := websocket.DefaultDialer.DialContext(ctx, wsURL, header)
	if err != nil {
		return nil, fmt.Errorf("deepgram ws dial: %w", err)
	}

	stream := &deepgramStream{
		conn:    conn,
		results: make(chan STTResult, 64),
		logger:  d.logger,
	}
	go stream.readLoop()
	return stream, nil
}

// deepgramStream wraps a live Deepgram WebSocket connection.
type deepgramStream struct {
	mu      sync.Mutex
	conn    *websocket.Conn
	results chan STTResult
	logger  *zap.Logger
}

// deepgramResponse mirrors the Deepgram streaming JSON envelope.
type deepgramResponse struct {
	Type    string `json:"type"`
	Channel struct {
		Alternatives []struct {
			Transcript string  `json:"transcript"`
			Confidence float64 `json:"confidence"`
		} `json:"alternatives"`
	} `json:"channel"`
	IsFinal    bool    `json:"is_final"`
	SpeechFinal bool   `json:"speech_final"` // true when VAD detects end of utterance
	Start      float64 `json:"start"`
	Duration   float64 `json:"duration"`
}

func (s *deepgramStream) Send(pcm []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
	return s.conn.WriteMessage(websocket.BinaryMessage, pcm)
}

func (s *deepgramStream) Results() <-chan STTResult {
	return s.results
}

func (s *deepgramStream) Reset() {
	// Send a KeepAlive to reset Deepgram's VAD state
	s.mu.Lock()
	defer s.mu.Unlock()
	payload, _ := json.Marshal(map[string]string{"type": "KeepAlive"})
	s.conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
	_ = s.conn.WriteMessage(websocket.TextMessage, payload)
}

func (s *deepgramStream) Close() {
	// Gracefully close: send CloseStream, then close the WS
	s.mu.Lock()
	payload, _ := json.Marshal(map[string]string{"type": "CloseStream"})
	s.conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
	_ = s.conn.WriteMessage(websocket.TextMessage, payload)
	s.mu.Unlock()
	s.conn.Close()
}

func (s *deepgramStream) readLoop() {
	defer close(s.results)
	for {
		_, msg, err := s.conn.ReadMessage()
		if err != nil {
			return
		}
		var resp deepgramResponse
		if json.Unmarshal(msg, &resp) != nil {
			continue
		}
		if resp.Type != "Results" {
			continue
		}
		if len(resp.Channel.Alternatives) == 0 {
			continue
		}
		alt := resp.Channel.Alternatives[0]
		if alt.Transcript == "" {
			continue
		}
		s.results <- STTResult{
			Transcript: alt.Transcript,
			IsFinal:    resp.SpeechFinal,
			Confidence: alt.Confidence,
			Timestamp:  time.Now(),
		}
	}
}
