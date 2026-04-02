// openai_llm.go – OpenAI GPT-4o streaming LLM adapter with Function Calling.
// Uses Server-Sent Events (SSE) for token-level streaming to minimise TTFB.
// Supports parallel tool_calls for concurrent CRM lookups and webhook triggers.
package integrations

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
)

const openAIEndpoint = "https://api.openai.com/v1/chat/completions"

// Tool definitions exposed to the LLM via function calling.
var defaultTools = []map[string]any{
	{
		"type": "function",
		"function": map[string]any{
			"name":        "trigger_webhook",
			"description": "Send data to an external CRM (HubSpot/Salesforce) via webhook.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"url":     map[string]string{"type": "string", "description": "Target webhook URL"},
					"payload": map[string]any{"type": "object", "description": "JSON payload to send"},
				},
				"required": []string{"url", "payload"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name":        "query_knowledge_base",
			"description": "Search the sales objection manual for relevant responses.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"query": map[string]string{"type": "string", "description": "Search query"},
					"top_k": map[string]string{"type": "integer", "description": "Number of results to return"},
				},
				"required": []string{"query"},
			},
		},
	},
	{
		"type": "function",
		"function": map[string]any{
			"name":        "end_call",
			"description": "Gracefully terminate the call.",
			"parameters": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"reason": map[string]string{"type": "string", "description": "Reason for ending the call"},
				},
			},
		},
	},
}

// OpenAILLM implements LLMProvider backed by GPT-4o.
type OpenAILLM struct {
	apiKey string
	model  string
	client *http.Client
	logger *zap.Logger
}

// NewOpenAILLM creates a new OpenAI LLM adapter.
func NewOpenAILLM(apiKey string, logger *zap.Logger) *OpenAILLM {
	return &OpenAILLM{
		apiKey: apiKey,
		model:  "gpt-4o",
		client: &http.Client{Timeout: 60 * time.Second},
		logger: logger,
	}
}

func (o *OpenAILLM) ChatStream(ctx context.Context, messages []Turn) (LLMStream, error) {
	// Convert shared Turn type to OpenAI message format
	oaiMsgs := make([]map[string]any, 0, len(messages)+1)
	oaiMsgs = append(oaiMsgs, map[string]any{
		"role":    "system",
		"content": "You are a professional sales agent. Be concise, empathetic, and persuasive. Respond in ≤2 sentences to keep latency low.",
	})
	for _, m := range messages {
		oaiMsgs = append(oaiMsgs, map[string]any{
			"role":    m.Role,
			"content": m.Content,
		})
	}

	body, _ := json.Marshal(map[string]any{
		"model":       o.model,
		"messages":    oaiMsgs,
		"stream":      true,
		"tools":       defaultTools,
		"tool_choice": "auto",
		"temperature": 0.7,
		"max_tokens":  256, // short answers = lower latency
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, openAIEndpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+o.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	resp, err := o.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("openai request: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, fmt.Errorf("openai status %d", resp.StatusCode)
	}

	s := &openAIStream{
		resp:       resp,
		tokens:     make(chan LLMToken, 128),
		toolResult: make(chan FunctionResult, 4),
		logger:     o.logger,
	}
	go s.readSSE()
	return s, nil
}

type openAIStream struct {
	resp       *http.Response
	tokens     chan LLMToken
	toolResult chan FunctionResult
	logger     *zap.Logger
	fullText   string
}

func (s *openAIStream) Tokens() <-chan LLMToken {
	return s.tokens
}

func (s *openAIStream) SubmitToolResult(result FunctionResult) error {
	s.toolResult <- result
	return nil
}

func (s *openAIStream) Close() {
	s.resp.Body.Close()
}

// sseChunk mirrors the OpenAI streaming delta object.
type sseChunk struct {
	Choices []struct {
		Delta struct {
			Content   string `json:"content"`
			ToolCalls []struct {
				ID       string `json:"id"`
				Function struct {
					Name      string          `json:"name"`
					Arguments json.RawMessage `json:"arguments"`
				} `json:"function"`
			} `json:"tool_calls"`
		} `json:"delta"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
}

func (s *openAIStream) readSSE() {
	defer close(s.tokens)
	defer s.resp.Body.Close()

	scanner := bufio.NewScanner(s.resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			s.tokens <- LLMToken{Done: true, FullText: s.fullText}
			return
		}

		var chunk sseChunk
		if json.Unmarshal([]byte(data), &chunk) != nil || len(chunk.Choices) == 0 {
			continue
		}

		delta := chunk.Choices[0].Delta

		// Handle text token
		if delta.Content != "" {
			s.fullText += delta.Content
			s.tokens <- LLMToken{Text: delta.Content, FullText: s.fullText}
		}

		// Handle function call: emit token then wait for tool result with a hard timeout.
		// Without the timeout, a client that never sends a result would deadlock this goroutine.
		if len(delta.ToolCalls) > 0 {
			tc := delta.ToolCalls[0]
			s.tokens <- LLMToken{
				FunctionCall: &FunctionCallRequest{
					Name:      tc.Function.Name,
					Arguments: tc.Function.Arguments,
					CallID:    tc.ID,
				},
			}
			// Wait up to 30s for the caller to submit the tool result
			select {
			case <-s.toolResult:
				// result delivered; caller handles re-injection
			case <-time.After(30 * time.Second):
				s.logger.Warn("tool result timeout – abandoning function call",
					zap.String("tool", tc.Function.Name),
					zap.String("call_id", tc.ID),
				)
				// Emit an error token so the session can signal the client
				s.tokens <- LLMToken{Done: true, FullText: s.fullText}
				return
			}
		}

		if chunk.Choices[0].FinishReason == "stop" {
			s.tokens <- LLMToken{Done: true, FullText: s.fullText}
			return
		}
	}
}

// GroqLLM is an alternative LLM adapter using Groq (Llama 3 70B).
// Drop-in replacement for OpenAILLM for lower-latency inference.
type GroqLLM struct {
	apiKey string
	client *http.Client
	logger *zap.Logger
}

const groqEndpoint = "https://api.groq.com/openai/v1/chat/completions"

func NewGroqLLM(apiKey string, logger *zap.Logger) *GroqLLM {
	return &GroqLLM{
		apiKey: apiKey,
		client: &http.Client{Timeout: 30 * time.Second},
		logger: logger,
	}
}

// ChatStream for Groq reuses OpenAI-compatible SSE format with Llama-3.3-70b.
func (g *GroqLLM) ChatStream(ctx context.Context, messages []Turn) (LLMStream, error) {
	oaiMsgs := make([]map[string]any, 0, len(messages)+1)
	for _, m := range messages {
		oaiMsgs = append(oaiMsgs, map[string]any{"role": m.Role, "content": m.Content})
	}

	body, _ := json.Marshal(map[string]any{
		"model":       "llama-3.3-70b-versatile",
		"messages":    oaiMsgs,
		"stream":      true,
		"temperature": 0.7,
		"max_tokens":  256,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, groqEndpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+g.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("groq request: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("groq status %d: %s", resp.StatusCode, b)
	}

	s := &openAIStream{ // Groq uses OpenAI-compatible SSE
		resp:       resp,
		tokens:     make(chan LLMToken, 128),
		toolResult: make(chan FunctionResult, 4),
		logger:     g.logger,
	}
	go s.readSSE()
	return s, nil
}
