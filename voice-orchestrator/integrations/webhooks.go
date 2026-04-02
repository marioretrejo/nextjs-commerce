// webhooks.go – Webhook dispatcher for CRM integrations (HubSpot, Salesforce, etc.)
// Provides reliable delivery with exponential back-off retries and HMAC signing.
package integrations

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
)

const (
	maxRetries    = 3
	baseRetryWait = 500 * time.Millisecond
)

// WebhookDispatcher sends signed HTTP POST payloads to CRM endpoints.
type WebhookDispatcher struct {
	client    *http.Client
	sigSecret string // optional HMAC-SHA256 signing secret
	logger    *zap.Logger
}

// NewWebhookDispatcher creates a dispatcher. sigSecret may be empty to disable signing.
func NewWebhookDispatcher(logger *zap.Logger) *WebhookDispatcher {
	return &WebhookDispatcher{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		logger: logger,
	}
}

// WithSigningSecret attaches an HMAC signing secret.
func (d *WebhookDispatcher) WithSigningSecret(secret string) *WebhookDispatcher {
	d.sigSecret = secret
	return d
}

// Dispatch sends payload to url with optional headers, retrying on transient failures.
func (d *WebhookDispatcher) Dispatch(
	ctx context.Context,
	targetURL string,
	payload map[string]any,
	headers map[string]string,
) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			wait := baseRetryWait * (1 << (attempt - 1))
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(wait):
			}
		}

		if err := d.send(ctx, targetURL, body, headers); err != nil {
			lastErr = err
			d.logger.Warn("webhook attempt failed",
				zap.String("url", targetURL),
				zap.Int("attempt", attempt+1),
				zap.Error(err),
			)
			continue
		}
		return nil
	}
	return fmt.Errorf("webhook dispatch to %s failed after %d attempts: %w", targetURL, maxRetries+1, lastErr)
}

func (d *WebhookDispatcher) send(ctx context.Context, targetURL string, body []byte, extra map[string]string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "VoiceOrchestrator/1.0")

	// Optional HMAC signature header (HubSpot / Salesforce webhook verification style)
	if d.sigSecret != "" {
		mac := hmac.New(sha256.New, []byte(d.sigSecret))
		mac.Write(body)
		req.Header.Set("X-Signature-256", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	}

	for k, v := range extra {
		req.Header.Set(k, v)
	}

	resp, err := d.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	io.Copy(io.Discard, resp.Body)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("unexpected status %d", resp.StatusCode)
	}
	return nil
}

// HubSpotContact creates or updates a contact in HubSpot via the Contacts API.
func (d *WebhookDispatcher) HubSpotContact(ctx context.Context, accessToken string, props map[string]string) error {
	payload := map[string]any{
		"properties": props,
	}
	headers := map[string]string{
		"Authorization": "Bearer " + accessToken,
	}
	return d.Dispatch(ctx, "https://api.hubapi.com/crm/v3/objects/contacts", payload, headers)
}

// SalesforceCreateLead posts a new Lead record to a Salesforce org via a connected-app webhook.
func (d *WebhookDispatcher) SalesforceCreateLead(ctx context.Context, instanceURL, accessToken string, fields map[string]any) error {
	endpoint := fmt.Sprintf("%s/services/data/v59.0/sobjects/Lead/", instanceURL)
	headers := map[string]string{
		"Authorization": "Bearer " + accessToken,
	}
	return d.Dispatch(ctx, endpoint, fields, headers)
}
