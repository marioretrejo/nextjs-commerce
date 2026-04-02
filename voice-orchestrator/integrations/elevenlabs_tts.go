// elevenlabs_tts.go – ElevenLabs streaming TTS adapter.
// Uses the /v1/text-to-speech/{voice_id}/stream endpoint for chunk-level PCM
// delivery. Target TTFA (time-to-first-audio) under 300 ms.
//
// Also includes a CartesiaTTS adapter as a drop-in alternative.
package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
)

// ElevenLabsTTS implements TTSProvider backed by ElevenLabs.
type ElevenLabsTTS struct {
	apiKey  string
	voiceID string
	client  *http.Client
	logger  *zap.Logger
}

// NewElevenLabsTTS creates a new ElevenLabs TTS adapter.
func NewElevenLabsTTS(apiKey, voiceID string, logger *zap.Logger) *ElevenLabsTTS {
	return &ElevenLabsTTS{
		apiKey:  apiKey,
		voiceID: voiceID,
		client:  &http.Client{Timeout: 30 * time.Second},
		logger:  logger,
	}
}

// Synthesize sends text to ElevenLabs and returns a slice of PCM audio frames.
// Each frame is ≈20 ms of 16 kHz 16-bit mono PCM.
func (e *ElevenLabsTTS) Synthesize(ctx context.Context, text string) ([][]byte, error) {
	endpoint := fmt.Sprintf("https://api.elevenlabs.io/v1/text-to-speech/%s/stream", e.voiceID)

	body, _ := json.Marshal(map[string]any{
		"text":     text,
		"model_id": "eleven_turbo_v2_5", // lowest latency model
		"voice_settings": map[string]float64{
			"stability":        0.5,
			"similarity_boost": 0.75,
		},
		"output_format": "pcm_16000", // raw PCM, 16 kHz, 16-bit
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("xi-api-key", e.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "audio/mpeg") // ElevenLabs streams mp3/pcm depending on output_format

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("elevenlabs request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("elevenlabs status %d: %s", resp.StatusCode, b)
	}

	return streamToFrames(resp.Body, 640) // 640 bytes = 20 ms @ 16 kHz 16-bit mono
}

// CartesiaTTS implements TTSProvider backed by Cartesia (alternative low-latency TTS).
type CartesiaTTS struct {
	apiKey  string
	modelID string
	voiceID string
	client  *http.Client
	logger  *zap.Logger
}

// NewCartesiaTTS creates a new Cartesia TTS adapter.
func NewCartesiaTTS(apiKey, modelID, voiceID string, logger *zap.Logger) *CartesiaTTS {
	return &CartesiaTTS{
		apiKey:  apiKey,
		modelID: modelID,
		voiceID: voiceID,
		client:  &http.Client{Timeout: 30 * time.Second},
		logger:  logger,
	}
}

// Synthesize sends text to Cartesia and returns PCM frames.
func (c *CartesiaTTS) Synthesize(ctx context.Context, text string) ([][]byte, error) {
	endpoint := "https://api.cartesia.ai/tts/bytes"

	body, _ := json.Marshal(map[string]any{
		"model_id":   c.modelID,
		"transcript": text,
		"voice": map[string]any{
			"mode": "id",
			"id":   c.voiceID,
		},
		"output_format": map[string]any{
			"container":   "raw",
			"encoding":    "pcm_s16le",
			"sample_rate": 16000,
		},
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("Cartesia-Version", "2024-06-10")
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cartesia request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("cartesia status %d: %s", resp.StatusCode, b)
	}

	return streamToFrames(resp.Body, 640)
}

// streamToFrames reads a raw PCM stream and splits it into fixed-size frames.
// frameSize is in bytes (640 = 20 ms @ 16 kHz 16-bit mono).
func streamToFrames(r io.Reader, frameSize int) ([][]byte, error) {
	var frames [][]byte
	buf := make([]byte, frameSize)

	for {
		n, err := io.ReadFull(r, buf)
		if n > 0 {
			frame := make([]byte, n)
			copy(frame, buf[:n])
			frames = append(frames, frame)
		}
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			break
		}
		if err != nil {
			return frames, err
		}
	}
	return frames, nil
}
