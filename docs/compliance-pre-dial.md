# VoiceOS — Compliance Pre-Dial Engine

`lib/compliance/dial-eligibility.ts` — implemented in **Fase 12/Compliance**.

Every outbound call is evaluated against up to 12 sequential compliance checks
before any telephony resource (slot, LiveKit room, Twilio call) is created.

---

## Check Order

| #   | Check                                                 | Reason Code                                          | Block?                              |
| --- | ----------------------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| 1   | Phone number valid (libphonenumber-js)                | `invalid_phone_number`                               | Yes                                 |
| 2   | Workspace exists and is not suspended                 | `workspace_not_found` · `workspace_suspended`        | Yes                                 |
| 3   | Workspace not in minute overage                       | `workspace_overage_blocked` · `insufficient_balance` | Yes                                 |
| 4   | Campaign is active (if campaignId provided)           | `campaign_paused` · `campaign_inactive`              | Yes                                 |
| 5   | Phone not in DNC list (`dnc_entries` + `dnc_list`)    | `dnc`                                                | Yes                                 |
| 6   | No prior opt-out in call history                      | `opt_out`                                            | Yes                                 |
| 7   | Max retries not exceeded (campaign_contacts.attempts) | `max_retries_exceeded`                               | Yes                                 |
| 8   | Cooldown window elapsed since last call               | `cooldown_active`                                    | Yes                                 |
| 9   | Within allowed calling hours (compliance_settings)    | `outside_allowed_hours`                              | Yes                                 |
| 10  | Country allowed                                       | `country_not_allowed`                                | Stub — no schema yet                |
| 11  | Consent verified                                      | `missing_consent`                                    | Stub — no consent_logs yet          |
| 12  | Custom compliance rules                               | `custom_rule_blocked`                                | Stub — no machine-readable criteria |

The first failing check returns immediately (short-circuit). All checks write
to `dial_eligibility_checks` via `recordDialEligibilityCheck()` which is
fire-and-forget and never blocks dialing.

---

## Reason Codes

| Code                        | Meaning                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `invalid_phone_number`      | libphonenumber-js could not parse the number as valid                                                |
| `workspace_not_found`       | No workspace found for the given workspaceId                                                         |
| `workspace_suspended`       | Workspace has `is_suspended = true`                                                                  |
| `workspace_overage_blocked` | Workspace has `overage_blocked = true`                                                               |
| `insufficient_balance`      | `minutes_used >= minutes_limit` (and limit > 0)                                                      |
| `campaign_paused`           | Campaign `status = 'paused'`                                                                         |
| `campaign_inactive`         | Campaign `status` is completed/cancelled/inactive                                                    |
| `dnc`                       | Phone found in `dnc_entries` or `dnc_list` for this workspace                                        |
| `opt_out`                   | A prior call for this phone has `business_outcome` in (dnc, opt_out)                                 |
| `max_retries_exceeded`      | `campaign_contacts.attempts >= campaigns.max_retries`                                                |
| `cooldown_active`           | A call was made to this number within the cooldown window                                            |
| `outside_allowed_hours`     | `compliance_settings.calling_hours_enabled = true` and current time is outside the configured window |
| `eligibility_check_error`   | Unexpected internal error — fail-closed, call blocked                                                |

---

## Calling Hours Configuration

Controlled per workspace via `compliance_settings`:

| Column                  | Default                 | Effect                          |
| ----------------------- | ----------------------- | ------------------------------- |
| `calling_hours_enabled` | `false`                 | Must be `true` to enforce hours |
| `calling_hours_start`   | `'09:00'`               | Start time (inclusive)          |
| `calling_hours_end`     | `'18:00'`               | End time (exclusive)            |
| `calling_days`          | `{mon,tue,wed,thu,fri}` | Days of week allowed            |

**Timezone resolution** (in priority order):

1. `input.timezone` passed by caller
2. `_defaultTimezoneForCountry(country)` — coarse country → timezone map
3. `"UTC"` fallback (conservative)

If timezone cannot be determined for an automatic campaign, the engine uses
`"UTC"` which may block calls at unexpected local times. Configure explicit
timezone in the call or via the country detection.

---

## DNC Configuration

Add entries via `POST /api/compliance/dnc`:

```json
{ "phone": "+12125551234", "reason": "Customer requested" }
```

Or bulk:

```json
{ "phones": ["+12125551234", "+13105558765"] }
```

The engine checks **both** `dnc_entries` (from the DNC API) and `dnc_list`
(from the enterprise modules migration). A match in either table blocks the dial.

When a call completes with `business_outcome = 'dnc'`, future calls to that
number will be blocked by the opt-out check (check #6), even if it was not
explicitly added to the DNC list.

---

## Consent (Future Implementation)

The `require_consent` flag in `compliance_settings` documents an intent but
the `consent_logs` table does not yet exist. When it is created:

1. The engine will verify a `'granted'` status per `(workspace_id, phone)`.
2. If missing or `'revoked'`, the call will be blocked with `missing_consent`.

Until then, the consent check is a no-op (does not block).

---

## Viewing dial_eligibility_checks

```sql
-- Blocked calls in the last 24 hours
SELECT reason_code, count(*) as blocked
FROM dial_eligibility_checks
WHERE workspace_id = 'YOUR_WS_ID'
  AND allowed = false
  AND created_at > now() - interval '24 hours'
GROUP BY reason_code
ORDER BY blocked DESC;

-- All checks for a specific number
SELECT allowed, reason_code, reason, created_at
FROM dial_eligibility_checks
WHERE normalized_phone = '+12025551234'
ORDER BY created_at DESC
LIMIT 20;

-- Block rate by campaign
SELECT campaign_id, count(*) total, sum(case when not allowed then 1 else 0 end) blocked
FROM dial_eligibility_checks
WHERE workspace_id = 'YOUR_WS_ID'
GROUP BY campaign_id;
```

---

## Integration Points

### /api/calls/dial (manual dial from dashboard)

Eligibility is checked **before** `try_claim_call_slot`. If blocked:

```json
{
  "error": "Dial blocked by compliance",
  "reason_code": "dnc",
  "reason": "Phone number is on the Do Not Call list"
}
```

HTTP status: `422 Unprocessable Entity`.

### /api/cron/campaign-dial (automated campaign dialer)

Each contact in the dial loop is checked individually. DNC/opt-out contacts
are also marked `status = 'rejected'` in `campaign_contacts` so they are
never retried. Other block types (cooldown, outside_hours) are silent skips
that do not count as technical failures.

---

## Current Limitations

| Feature                 | Status                                                              |
| ----------------------- | ------------------------------------------------------------------- |
| Allowed-country list    | Not in schema — no-op                                               |
| Consent logs            | No `consent_logs` table — no-op                                     |
| Custom compliance rules | `compliance_rules` lacks machine-readable blocking criteria — no-op |
| Inbound calls           | Not checked (compliance pre-dial is outbound only)                  |

---

_Last updated: Fase 12 / Compliance Pre-dial_
