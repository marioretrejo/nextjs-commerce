/** Code-snippet generators, Postman/JSON export, and markdown docs. */

export function curlOutbound(apiKey: string) {
  return `curl -X POST https://app.voiceos.ai/api/v1/calls/outbound \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+12025551234",
    "agentId": "YOUR_AGENT_ID",
    "variables": {
      "customer_name": "Jane Smith"
    }
  }'`;
}

export function nodeOutbound(apiKey: string) {
  return `const response = await fetch(
  'https://app.voiceos.ai/api/v1/calls/outbound',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ${apiKey}',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: '+12025551234',
      agentId: 'YOUR_AGENT_ID',
      variables: { customer_name: 'Jane Smith' },
    }),
  }
);
const data = await response.json();
console.log(data.call_id); // "agent-abc123-1716000000000"`;
}

export function pythonOutbound(apiKey: string) {
  return `import requests

response = requests.post(
    'https://app.voiceos.ai/api/v1/calls/outbound',
    headers={
        'Authorization': 'Bearer ${apiKey}',
        'Content-Type': 'application/json',
    },
    json={
        'to': '+12025551234',
        'agentId': 'YOUR_AGENT_ID',
        'variables': {'customer_name': 'Jane Smith'},
    },
)
data = response.json()
print(data['call_id'])  # "agent-abc123-1716000000000"`;
}

export function curlWebhook(apiKey: string) {
  return `curl -X POST https://app.voiceos.ai/api/v1/webhooks \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-server.com/webhooks/voiceos",
    "events": ["call.completed", "call.failed"],
    "description": "Production CRM webhook"
  }'`;
}

export function nodeWebhookVerify(secret: string) {
  return `const crypto = require('crypto');

function verifyWebhook(rawBody, signature, secret) {
  const [tPart, vPart] = signature.split(',');
  const ts = tPart.replace('t=', '');
  const received = vPart.replace('v1=', '');

  // Reject events older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  const expected = crypto
    .createHmac('sha256', '${secret}')
    .update(\`\${ts}.\${rawBody}\`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(received)
  );
}

// In your Express handler:
app.post('/webhooks/voiceos', express.raw({ type: '*/*' }), (req, res) => {
  const sig = req.headers['x-voiceos-signature'];
  if (!verifyWebhook(req.body.toString(), sig, process.env.VOICEOS_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  const event = JSON.parse(req.body.toString());
  console.log('Event:', event.event, event.call_id);
  res.sendStatus(200);
});`;
}

// ─── Components ───────────────────────────────────────────────────────────────

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(
  text: string,
  filename: string,
  type = "text/plain",
) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function buildPostmanCollection(
  spec: Record<string, unknown>,
  apiKey: string,
) {
  const info = spec.info as Record<string, unknown>;
  const paths = spec.paths as Record<string, Record<string, unknown>>;
  const items = Object.entries(paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, op]) => {
      const operation = op as Record<string, unknown>;
      return {
        name: operation.summary ?? path,
        request: {
          method: method.toUpperCase(),
          header: [
            { key: "Authorization", value: `Bearer ${apiKey}`, type: "text" },
            { key: "Content-Type", value: "application/json", type: "text" },
          ],
          url: {
            raw: `https://app.voiceos.ai${path}`,
            protocol: "https",
            host: ["app", "voiceos", "ai"],
            path: path.split("/").filter(Boolean),
          },
          body:
            method === "post" || method === "patch"
              ? {
                  mode: "raw",
                  raw: "{}",
                  options: { raw: { language: "json" } },
                }
              : undefined,
        },
        response: [],
      };
    }),
  );

  return {
    info: {
      name: `VoiceOS API — ${info.version as string}`,
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: {
      type: "bearer",
      bearer: [{ key: "token", value: apiKey, type: "string" }],
    },
    item: items,
  };
}

export function buildMarkdownDocs(apiKey: string): string {
  return `# VoiceOS API Reference

**Version:** 1.0.0
**Base URL:** \`https://app.voiceos.ai\`

## Authentication

All requests must include your API key:

\`\`\`
Authorization: Bearer ${apiKey}
\`\`\`

Generate keys from **Settings → API Keys** in your dashboard.

---

## Endpoints

### POST /api/v1/calls/outbound

Trigger an outbound AI voice call.

**Request body:**

| Field | Type | Required | Description |
|---|---|---|---|
| \`to\` | string | ✓ | Recipient phone (E.164, e.g. \`+12025551234\`) |
| \`agentId\` | string (UUID) | ✓ | Agent to use for the call |
| \`from\` | string | — | Caller ID override |
| \`variables\` | object | — | Dynamic variables injected into agent prompt |

**cURL:**

\`\`\`bash
curl -X POST https://app.voiceos.ai/api/v1/calls/outbound \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"to":"+12025551234","agentId":"YOUR_AGENT_ID"}'
\`\`\`

**Response (200):**

\`\`\`json
{
  "call_id": "agent-abc123-1716000000000",
  "room_name": "agent-abc123-1716000000000",
  "twilio_call_sid": "CA1234567890abcdef",
  "status": "dialing"
}
\`\`\`

---

### GET /api/v1/webhooks

List all webhook endpoints for your workspace.

\`\`\`bash
curl https://app.voiceos.ai/api/v1/webhooks \\
  -H "Authorization: Bearer ${apiKey}"
\`\`\`

---

### POST /api/v1/webhooks

Register a new webhook endpoint.

> **Important:** The \`secret\` is returned only once. Store it securely.

\`\`\`bash
curl -X POST https://app.voiceos.ai/api/v1/webhooks \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://your-server.com/webhooks/voiceos","events":["call.completed"]}'
\`\`\`

---

### PATCH /api/v1/webhooks/{id}

Update a webhook endpoint.

\`\`\`bash
curl -X PATCH https://app.voiceos.ai/api/v1/webhooks/{id} \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"is_active":false}'
\`\`\`

---

### DELETE /api/v1/webhooks/{id}

Permanently delete a webhook endpoint.

\`\`\`bash
curl -X DELETE https://app.voiceos.ai/api/v1/webhooks/{id} \\
  -H "Authorization: Bearer ${apiKey}"
\`\`\`

---

## Webhook Signatures

Every delivery includes:

\`\`\`
X-VoiceOS-Signature: t=1716000000,v1=abc123...
\`\`\`

**Verification (Node.js):**

\`\`\`js
const crypto = require('crypto');
function verify(body, sig, secret) {
  const [t, v] = sig.split(',');
  const ts = t.replace('t=','');
  const recv = v.replace('v1=','');
  if (Math.abs(Date.now()/1000 - ts) > 300) return false;
  const exp = crypto.createHmac('sha256', secret).update(\`\${ts}.\${body}\`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(recv));
}
\`\`\`

**Verification (Python):**

\`\`\`python
import hmac, hashlib, time

def verify(body: bytes, signature: str, secret: str) -> bool:
    parts = dict(p.split('=', 1) for p in signature.split(','))
    ts, recv = parts['t'], parts['v1']
    if abs(time.time() - float(ts)) > 300:
        return False
    expected = hmac.new(secret.encode(), f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, recv)
\`\`\`

---

## Rate Limits

| Header | Description |
|---|---|
| \`X-RateLimit-Limit\` | Requests allowed per window |
| \`X-RateLimit-Remaining\` | Requests remaining |
| \`X-RateLimit-Reset\` | Unix timestamp when window resets |
| \`Retry-After\` | Seconds to wait after a 429 |

Standard limits: **10 req/s**, burst **50**.

---

## Error Codes

| Status | Meaning |
|---|---|
| 400 | Bad request — invalid body or parameters |
| 401 | Missing or invalid API key |
| 403 | Workspace suspended or limit reached |
| 404 | Resource not found |
| 429 | Rate limit or concurrent call limit exceeded |
| 502 | Upstream telephony error (Twilio) |
`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
