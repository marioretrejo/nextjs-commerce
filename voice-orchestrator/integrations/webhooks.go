// webhooks.go – Webhook dispatcher for CRM integrations (HubSpot, Salesforce, etc.)
// Provides reliable delivery with exponential back-off retries and HMAC signing.
// SSRF protection: only HTTPS URLs to non-private hosts are accepted.
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
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"go.uber.org/zap"
)

const (
	maxRetries    = 3
	baseRetryWait = 500 * time.Millisecond
)

// WebhookDispatcher sends signed HTTP POST payloads to CRM endpoints.
type WebhookDispatcher struct {
	client       *http.Client
	sigSecret    string // optional HMAC-SHA256 signing secret
	allowedHosts []string // optional allowlist (env: ALLOWED_WEBHOOK_HOSTS, comma-separated)
	logger       *zap.Logger
}

// NewWebhookDispatcher creates a dispatcher. sigSecret may be empty to disable signing.
func NewWebhookDispatcher(logger *zap.Logger) *WebhookDispatcher {
	var allowed []string
	if raw := os.Getenv("ALLOWED_WEBHOOK_HOSTS"); raw != "" {
		for _, h := range strings.Split(raw, ",") {
			if t := strings.TrimSpace(h); t != "" {
				allowed = append(allowed, strings.ToLower(t))
			}
		}
	}
	return &WebhookDispatcher{
		client:       &http.Client{Timeout: 10 * time.Second},
		allowedHosts: allowed,
		logger:       logger,
	}
}

// WithSigningSecret attaches an HMAC signing secret.
func (d *WebhookDispatcher) WithSigningSecret(secret string) *WebhookDispatcher {
	d.sigSecret = secret
	return d
}

// validateWebhookURL enforces SSRF protections:
//   - Must be HTTPS
//   - Hostname must not resolve to a private/loopback/link-local address
//   - If ALLOWED_WEBHOOK_HOSTS is set, hostname must be in that list
func validateWebhookURL(rawURL string, allowedHosts []string) error {
	u, err := url.ParseRequestURI(rawURL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}
	if u.Scheme != "https" {
		return fmt.Errorf("webhook URL must use HTTPS, got %q", u.Scheme)
	}

	host := strings.ToLower(u.Hostname())

	// Allowlist check (if configured)
	if len(allowedHosts) > 0 {
		allowed := false
		for _, h := range allowedHosts {
			if host == h || strings.HasSuffix(host, "."+h) {
				allowed = true
				break
			}
		}
		if !allowed {
			return fmt.Errorf("host %q is not in the webhook allowlist", host)
		}
	}

	// Block private/loopback ranges via DNS resolution
	addrs, err := net.LookupHost(host)
	if err != nil {
		return fmt.Errorf("DNS lookup failed for %q: %w", host, err)
	}
	for _, addr := range addrs {
		ip := net.ParseIP(addr)
		if ip == nil {
			continue
		}
		if isPrivateOrLoopback(ip) {
			return fmt.Errorf("host %q resolves to a private/loopback address (%s), blocked for SSRF protection", host, addr)
		}
	}
	return nil
}

// isPrivateOrLoopback returns true for RFC-1918, loopback, link-local,
// and cloud metadata ranges.
func isPrivateOrLoopback(ip net.IP) bool {
	privateRanges := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"127.0.0.0/8",
		"::1/128",
		"fc00::/7",
		"fe80::/10",
		"169.254.0.0/16", // AWS/GCP metadata
	}
	for _, cidr := range privateRanges {
		_, network, _ := net.ParseCIDR(cidr)
		if network != nil && network.Contains(ip) {
			return true
		}
	}
	return false
}

// Dispatch validates the target URL then sends payload with retry and HMAC signing.
func (d *WebhookDispatcher) Dispatch(
	ctx context.Context,
	targetURL string,
	payload map[string]any,
	headers map[string]string,
) error {
	if err := validateWebhookURL(targetURL, d.allowedHosts); err != nil {
		return fmt.Errorf("webhook URL rejected: %w", err)
	}

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

	if d.sigSecret != "" {
		mac := hmac.New(sha256.New, []byte(d.sigSecret))
		mac.Write(body)
		req.Header.Set("X-Signature-256", "sha256="+hex.EncodeToString(mac.Sum(nil)))
	} else {
		d.logger.Warn("webhook sent without HMAC signature (sigSecret not configured)")
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
	payload := map[string]any{"properties": props}
	headers := map[string]string{"Authorization": "Bearer " + accessToken}
	return d.Dispatch(ctx, "https://api.hubapi.com/crm/v3/objects/contacts", payload, headers)
}

// SalesforceCreateLead posts a new Lead record to a Salesforce org via a connected-app webhook.
func (d *WebhookDispatcher) SalesforceCreateLead(ctx context.Context, instanceURL, accessToken string, fields map[string]any) error {
	endpoint := fmt.Sprintf("%s/services/data/v59.0/sobjects/Lead/", instanceURL)
	headers := map[string]string{"Authorization": "Bearer " + accessToken}
	return d.Dispatch(ctx, endpoint, fields, headers)
}
