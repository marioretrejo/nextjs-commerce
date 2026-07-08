# Call Import — External Provider Integration

Import completed calls from external VoIP/CRM platforms (Squaretalk, Voiso,
CommPeak, n8n, or any custom webhook) into VoiceOP's QA Center. Imported calls
land in the same `calls` table as native calls and flow through the existing
transcription → analysis → QA-scoring pipeline, appearing in **/calls** and
**/quality**.

## Setup

1. Go to **Integrations → Call Providers**.
2. Click **Connect Call Provider**.
3. Choose a provider and **Webhook Receiver** as the connection method.
4. (Optional) pick a **Default agent** — otherwise the importer matches the
   payload's `agent_name` against your agents by name.
5. Copy the **Webhook URL** and **Secret** shown once on creation. If you lose
   the secret, use **Rotate** to mint a new one.

## Endpoint

```
POST /api/import/calls/{integrationId}
```

### Headers

```
Content-Type: application/json
x-voiceop-import-secret: <secret_generated_by_app>
```

A missing or incorrect secret returns `401`. An inactive integration returns
`403`.

### Body (recommended n8n / custom payload)

```json
{
  "call_id": "abc123",
  "agent_name": "Training 09",
  "duration_seconds": 180,
  "department": "Conversion",
  "timestamp": "2026-07-07T15:30:00Z",
  "prospect_id": "prospect_001",
  "crm_id": "unit_001",
  "recording_url": "https://...",
  "recording_base64": null,
  "transcript": null,
  "call_type": "outbound",
  "extension": "101"
}
```

Only `call_id` (the external call id) is strictly required. Provider-specific
field names (e.g. Squaretalk `uniqueid`/`billsec`, Voiso `talk_time`) are mapped
automatically by the per-provider normalizers; the canonical names above always
work.

### Recording

- `recording_base64` — uploaded to private Storage (never stored in the DB).
- `recording_url` — downloaded server-side (SSRF-guarded) and mirrored to
  Storage; if the download fails the original URL is kept as a fallback.
- If no transcript is provided, the call is transcribed from the recording via
  Deepgram during analysis.

### Responses

```json
// new call imported
{ "ok": true, "duplicate": false, "call_id": "...", "analysis_status": "pending" }

// duplicate (same workspace + provider + external call id)
{ "ok": true, "duplicate": true, "call_id": "..." }

// no agent could be resolved (set a default agent on the integration)
{ "ok": false, "error": "No agent matched ..." }   // HTTP 422
```

## Idempotency

Calls dedup on `(workspace_id, external_source, external_call_id)`. Re-delivering
the same `call_id` returns `duplicate: true` without creating a second call.

## After import

The importer triggers `/api/jobs/analyze-call` with `{ call_id }` in the
background. Analysis:

1. transcribes the recording if no transcript was supplied,
2. extracts summary / sentiment / disposition / structured fields,
3. scores QA against the agent's `qa_criteria` (or system prompt) →
   `qa_score`, `qa_feedback`, and a per-criterion `qa_details` breakdown,
4. sets `analysis_status` (`pending → processing → analyzed | error`).

Once `qa_score` is set the call appears automatically in **/quality**.

## n8n example

Use an **HTTP Request** node:

- Method: `POST`
- URL: the integration's webhook URL
- Headers: `x-voiceop-import-secret` = your secret
- Body (JSON): the payload above, mapped from your workflow's call data.
