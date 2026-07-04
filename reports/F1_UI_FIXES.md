# FASE F1 — Conversion & Layout fixes

## ✅ Done (verified: tsc 0, lint 0, 460 unit tests, build OK)

### 1. Unified account state — the #1 conversion bug

**Bug:** `ActivationBanner` hard-coded "Your account is inactive" and the layout
showed it whenever `stripe_balance_cents === 0`, so a FREE trial user with
"50 min left" in the header saw "inactive" at the exact moment of conversion.

**Fix (test-first, billing path):**

- New pure `lib/account-state.ts` → `getAccountState(workspace)` returns
  `trial_active | trial_exhausted | paid_active | suspended | inactive`,
  derived from minutes, prepaid balance, minute-cap and suspension flags.
  8 unit tests in `agent/tests/account-state.test.ts` (registered in
  `test:unit`), including the exact "$0 balance + 50 min left ⇒ trial_active
  (NOT inactive)" regression.
- `ActivationBanner` now renders per state: **trial_active** → soft blue
  "free trial · N min left · Upgrade" (no alarm); **trial_exhausted** →
  amber "trial used up · Add credit"; **inactive** → amber "account inactive".
- `app/(app)/layout.tsx` derives the banner visibility from
  `accountStateNeedsBanner(getAccountState(workspace))` — the same source the
  header minutes pill reads, so they can no longer contradict.

### 2. Reusable EmptyState

- New `components/ui/empty-state.tsx` (icon + title + description + action,
  `compact` variant for charts). Ready to drop into any chart/table/sparkline
  that can receive zero data.

## ⚠️ Remaining F1 items — need the running app to verify (pure visual)

These are layout/CSS positioning fixes whose correctness can only be confirmed
by looking at the rendered dashboard (not possible in this headless env). They
are **not** yet applied, to avoid shipping blind CSS changes that could regress
other viewports:

- **Sparkline empty state** — apply `<EmptyState compact />` to the qa-center
  trend chart that renders a solid bar at 0 data. (The `ScoreGauge` at line 231
  is fine at 0; the offending sparkline is elsewhere in the 3,474-line file and
  should be located during the F4 decomposition, then guarded.)
- **Language switcher** (`components/layout/language-switcher.tsx`) — its
  `absolute bottom-full` overlaps the "Campaigns" nav item; move it into the
  fixed sidebar footer or the header. Verify at 390 px.
- **Sidebar logo** — the broken vertical bars next to "VoiceOS" (likely an
  unresolved skeleton / bad SVG viewBox); needs a fix + text fallback.
- **Floating AI button** — overlaps the Live Calls card; add compensating
  bottom padding or reposition.

Recommend pairing these with a Playwright screenshot pass (F1 gate mentions
`npx playwright screenshot`) so before/after can be captured — that requires a
running instance with credentials.
