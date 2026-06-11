#!/usr/bin/env bash
# Canary Call #1 — single outbound call via campaign
# Sourced from .env.local — no credentials hardcoded here
set -euo pipefail

set -a && source "$(dirname "$0")/../.env.local" && set +a

SUPA="${NEXT_PUBLIC_SUPABASE_URL}/rest/v1"
KEY="${SUPABASE_SERVICE_ROLE_KEY}"
AGENT_ID="295cdc22-f4da-45ed-8f7b-3815b3a0ea5f"
WS_ID="cd7b409f-82a3-4da2-8f7c-d49c11d62105"
PHONE="+18099052406"
VERCEL_URL="https://nextjs-commerce-git-claude-voic-6cb608-marios-projects-0d440ccd.vercel.app"

supa_get() { curl -sf "${SUPA}/$1" -H "Authorization: Bearer ${KEY}" -H "apikey: ${KEY}" -H "Accept: application/json"; }
supa_post() { curl -sf -X POST "${SUPA}/$1" -H "Authorization: Bearer ${KEY}" -H "apikey: ${KEY}" \
               -H "Content-Type: application/json" -H "Prefer: return=representation" -d "$2"; }
supa_patch() { curl -sf -X PATCH "${SUPA}/$1" -H "Authorization: Bearer ${KEY}" -H "apikey: ${KEY}" \
                -H "Content-Type: application/json" -H "Prefer: return=representation" -d "$2"; }

echo "=== PRE-DIAL COMPLIANCE CHECK ==="

echo "--- Workspace status ---"
supa_get "workspaces?id=eq.${WS_ID}&select=id,name,minutes_used,minutes_limit,is_suspended,billing_status" | jq .

echo "--- DNC workspace list ---"
supa_get "dnc_list?workspace_id=eq.${WS_ID}&phone=eq.$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$PHONE")&select=phone" | jq .

echo "--- Past opt-outs for this number ---"
supa_get "calls?workspace_id=eq.${WS_ID}&contact_phone=eq.$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))' "$PHONE")&business_outcome=in.(dnc,opt_out)&select=id,business_outcome,created_at&limit=5" | jq .

echo "--- Compliance settings ---"
supa_get "compliance_settings?workspace_id=eq.${WS_ID}&select=*" | jq .

echo ""
echo "=== CREATE CANARY CAMPAIGN ==="

CAMPAIGN=$(supa_post "campaigns" "{
  \"workspace_id\": \"${WS_ID}\",
  \"name\": \"Canary-Call-1-$(date +%Y%m%d-%H%M%S)\",
  \"agent_id\": \"${AGENT_ID}\",
  \"max_concurrency\": 1,
  \"retry_enabled\": false,
  \"max_retries\": 0,
  \"status\": \"draft\",
  \"timezone\": \"America/Santo_Domingo\"
}")
echo "$CAMPAIGN" | jq .
CAMPAIGN_ID=$(echo "$CAMPAIGN" | jq -r '.[0].id // .id')
echo "campaign_id=${CAMPAIGN_ID}"

echo ""
echo "=== ADD CONTACT ==="

CONTACT=$(supa_post "campaign_contacts" "{
  \"campaign_id\": \"${CAMPAIGN_ID}\",
  \"workspace_id\": \"${WS_ID}\",
  \"phone\": \"${PHONE}\",
  \"name\": \"Canary-Contact-1\",
  \"status\": \"pending\"
}")
echo "$CONTACT" | jq .
CONTACT_ID=$(echo "$CONTACT" | jq -r '.[0].id // .id')
echo "contact_id=${CONTACT_ID}"

echo ""
echo "=== ACTIVATE CAMPAIGN ==="

supa_patch "campaigns?id=eq.${CAMPAIGN_ID}" '{"status": "active"}' | jq .

echo ""
echo "=== TRIGGER CAMPAIGN DIAL CRON ==="
echo "Calling ${VERCEL_URL}/api/cron/campaign-dial ..."

DIAL_RESULT=$(curl -sf "${VERCEL_URL}/api/cron/campaign-dial" \
  -H "Authorization: Bearer ${INTERNAL_API_SECRET}" \
  -H "Accept: application/json")
echo "${DIAL_RESULT}" | jq .

echo ""
echo "campaign_id=${CAMPAIGN_ID}"
echo "contact_id=${CONTACT_ID}"
