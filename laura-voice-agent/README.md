# Laura Voice Agent

Automated outbound sales calls using **ElevenLabs Conversational AI** + **Google Sheets** as the lead database.

---

## Architecture

```
Google Sheets (Leads)
      │
      ▼  every POLL_INTERVAL_SECONDS
 sheet-poller ──► call-dispatcher ──► ElevenLabs Outbound API
                                              │
                                     (call in progress)
                                              │
                                   ElevenLabs POST webhook
                                              │
                                    webhook-receiver
                                    ┌────────┴────────┐
                               calificado         no_contesta
                                    │                  │
                            transfer-router     retry-scheduler
                                    │                  │
                             Estado=transferido   re-queue after
                                               RETRY_DELAY_MINUTES
```

---

## Google Sheet Structure

Sheet name: **Leads**

| Col | Field | Description |
|-----|-------|-------------|
| A | Nombre | Lead's full name |
| B | Teléfono | Phone in E.164 format: `+521234567890` |
| C | Email | Email address |
| D | Estado | `pendiente` \| `llamando` \| `calificado` \| `transferido` \| `no_contesta` \| `rechazado` \| `agotado` \| `error` |
| E | Conv_ID | ElevenLabs conversation_id (written automatically) |
| F | Intentos | Number of call attempts (integer) |
| G | Último_Intento | ISO timestamp of last attempt |
| H | Resultado | Human-readable outcome |
| I | Transcript | Call transcript (from webhook) |

**To add a new lead:** set Estado = `pendiente`, fill Nombre + Teléfono. Leave the rest blank.

---

## Setup

### 1. Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com) → IAM & Admin → Service Accounts
2. Create a service account (e.g. `laura-bot@your-project.iam.gserviceaccount.com`)
3. Create a JSON key → download as `credentials.json` → place in project root
4. Enable the **Google Sheets API** in your project
5. Share your Google Sheet with the service account email (Editor role)

### 2. ElevenLabs Agent

1. Create a Conversational AI agent in ElevenLabs
2. Note the **Agent ID** → set as `ELEVENLABS_AGENT_ID`
3. Configure Laura's first message and system prompt for outbound sales
4. Add the `transfer_to_agent` tool (see section below)
5. Connect a telephony provider (Twilio / SIP) to the agent
6. Configure the webhook URL (see section below)

### 3. Environment Variables

```bash
cp .env.example .env
```

Edit `.env`:

```env
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_AGENT_ID=agent_...
SIP_CALLCENTER_NUMBER=+521234567890   # number to transfer qualified leads to

GOOGLE_SHEET_ID=1abc...              # from the sheet URL
GOOGLE_CREDENTIALS_PATH=./credentials.json

MAX_CONCURRENT=3                     # max simultaneous calls
POLL_INTERVAL_SECONDS=30
RETRY_DELAY_MINUTES=120              # wait between retries for no_answer
MAX_RETRIES=3

WEBHOOK_PORT=3000
WEBHOOK_SECRET=your_random_secret    # set in ElevenLabs webhook settings
```

### 4. Install & Run

```bash
npm install
node index.js
```

---

## Exposing the Webhook (local dev with ngrok)

```bash
ngrok http 3000
```

You'll get a URL like `https://abc123.ngrok-free.app`.

Configure in ElevenLabs:
- **Conversation lifecycle webhook:** `https://abc123.ngrok-free.app/webhook/elevenlabs`
- **Webhook secret:** same value as `WEBHOOK_SECRET` in `.env`

---

## Configuring Laura's `transfer_to_agent` Tool in ElevenLabs

1. Open your agent → **Tools** tab → **Add Tool** → choose **Webhook**
2. Configure:

| Field | Value |
|-------|-------|
| Tool name | `transfer_to_agent` |
| Description | `Call this when the lead is interested and ready to speak with a human agent` |
| Method | POST |
| URL | `https://YOUR_NGROK_OR_DOMAIN/webhook/transfer` |

3. Request body template:
```json
{
  "conversation_id": "{{conversation_id}}",
  "qualified": true
}
```

4. Laura's system prompt should include:
> *When the prospect confirms interest and wants to proceed, call the `transfer_to_agent` tool immediately.*

---

## Logs

- `logs/combined.log` — all logs
- `logs/error.log` — errors only
- Console output also enabled

---

## Production Deployment

For production, use a fixed public URL instead of ngrok:
- Deploy on a VPS / Railway / Render
- Set `WEBHOOK_PORT=3000` and proxy with nginx
- Use a process manager: `pm2 start index.js --name laura`

```bash
npm install -g pm2
pm2 start index.js --name laura
pm2 save
pm2 startup
```
