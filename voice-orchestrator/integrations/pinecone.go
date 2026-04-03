// pinecone.go – Pinecone vector database client for RAG-based context retrieval.
// Used to fetch relevant sales objection rebuttals and product FAQs at inference
// time without bloating the prompt context window.
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

// PineconeClient wraps the Pinecone REST query API.
type PineconeClient struct {
	apiKey    string
	indexHost string // e.g. "https://my-index-xyz.svc.pinecone.io"
	client    *http.Client
	embedder  TextEmbedder
	logger    *zap.Logger
}

// TextEmbedder converts text to a dense float32 vector.
// Use OpenAI text-embedding-3-small in practice.
type TextEmbedder interface {
	Embed(ctx context.Context, text string) ([]float32, error)
}

// NewPineconeClient creates a new Pinecone adapter.
// embedder may be nil; in that case Query uses the Pinecone inference endpoint.
func NewPineconeClient(apiKey, indexHost string, logger *zap.Logger) *PineconeClient {
	return &PineconeClient{
		apiKey:    apiKey,
		indexHost: indexHost,
		client:    &http.Client{Timeout: 5 * time.Second}, // strict timeout to not stall the pipeline
		logger:    logger,
	}
}

// WithEmbedder attaches an embedding model for local vector generation.
func (p *PineconeClient) WithEmbedder(e TextEmbedder) *PineconeClient {
	p.embedder = e
	return p
}

// pineconeQueryRequest mirrors the Pinecone /query REST body.
type pineconeQueryRequest struct {
	Vector          []float32         `json:"vector,omitempty"`
	SparseVector    any               `json:"sparseVector,omitempty"`
	TopK            int               `json:"topK"`
	IncludeMetadata bool              `json:"includeMetadata"`
	Filter          map[string]any    `json:"filter,omitempty"`
	Namespace       string            `json:"namespace,omitempty"`
}

type pineconeQueryResponse struct {
	Matches []struct {
		ID       string             `json:"id"`
		Score    float64            `json:"score"`
		Metadata map[string]any     `json:"metadata"`
	} `json:"matches"`
}

// Query performs a nearest-neighbour search and returns the top-k matching documents.
// Falls back to a keyword hint when embedder is unavailable.
func (p *PineconeClient) Query(ctx context.Context, text string, topK int) ([]VectorHit, error) {
	var vector []float32

	if p.embedder != nil {
		var err error
		vector, err = p.embedder.Embed(ctx, text)
		if err != nil {
			p.logger.Warn("embedding failed, skipping RAG", zap.Error(err))
			return nil, err
		}
	} else {
		// No embedder: use Pinecone's own inference (requires the index to be configured with an embed model)
		return p.queryByText(ctx, text, topK)
	}

	body, _ := json.Marshal(pineconeQueryRequest{
		Vector:          vector,
		TopK:            topK,
		IncludeMetadata: true,
	})

	return p.doQuery(ctx, body)
}

// queryByText uses Pinecone's inference API to embed and query in one call.
func (p *PineconeClient) queryByText(ctx context.Context, text string, topK int) ([]VectorHit, error) {
	body, _ := json.Marshal(map[string]any{
		"inputs": []map[string]string{{"text": text}},
		"topK":   topK,
		"includeMetadata": true,
	})
	return p.doQuery(ctx, body)
}

func (p *PineconeClient) doQuery(ctx context.Context, body []byte) ([]VectorHit, error) {
	endpoint := fmt.Sprintf("%s/query", p.indexHost)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Api-Key", p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("pinecone query: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pinecone status %d: %s", resp.StatusCode, b)
	}

	var result pineconeQueryResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	hits := make([]VectorHit, 0, len(result.Matches))
	for _, m := range result.Matches {
		text := ""
		if t, ok := m.Metadata["text"].(string); ok {
			text = t
		}
		hits = append(hits, VectorHit{ID: m.ID, Score: m.Score, Text: text})
	}
	return hits, nil
}

// Upsert stores document chunks into the index (used during knowledge-base ingestion).
func (p *PineconeClient) Upsert(ctx context.Context, id, text string, vector []float32, metadata map[string]any) error {
	if metadata == nil {
		metadata = map[string]any{}
	}
	metadata["text"] = text

	body, _ := json.Marshal(map[string]any{
		"vectors": []map[string]any{
			{"id": id, "values": vector, "metadata": metadata},
		},
	})

	endpoint := fmt.Sprintf("%s/vectors/upsert", p.indexHost)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Api-Key", p.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("pinecone upsert status %d: %s", resp.StatusCode, b)
	}
	return nil
}
