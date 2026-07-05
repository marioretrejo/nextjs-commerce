#!/usr/bin/env node
/**
 * i18n audit (Task 2 gate).
 *
 * (b) Key parity: es.json must have exactly the same keys as en.json (the
 *     source of truth). Missing/extra keys → non-zero exit.
 * (a) Hardcoded strings: every file listed in MIGRATED_ROUTES is scanned for
 *     JSX text nodes of >= 3 words that are not wrapped in a t()/translation
 *     call. As routes are migrated they get added here and stay clean.
 *
 * The 8 non-en/es locales intentionally inherit missing keys from en at runtime
 * (see i18n/request.ts deepMerge) — they are reported as info, not failures.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Routes/components whose hardcoded strings have been migrated to i18n keys.
// Add files here as they are migrated; the scan keeps them from regressing.
const MIGRATED_ROUTES = [
  // e.g. "components/layout/header.tsx",
];

function load(locale) {
  return JSON.parse(
    readFileSync(join(root, "messages", `${locale}.json`), "utf8"),
  );
}

function flatten(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...flatten(v, key));
    } else {
      keys.push(key);
    }
  }
  return keys;
}

let failed = false;

// ── (b) es/en parity ────────────────────────────────────────────────────────
const enKeys = new Set(flatten(load("en")));
const esKeys = new Set(flatten(load("es")));
const missingInEs = [...enKeys].filter((k) => !esKeys.has(k));
const extraInEs = [...esKeys].filter((k) => !enKeys.has(k));

if (missingInEs.length || extraInEs.length) {
  failed = true;
  console.error("✗ es/en key parity FAILED");
  if (missingInEs.length)
    console.error("  missing in es.json:", missingInEs.join(", "));
  if (extraInEs.length)
    console.error("  extra in es.json (not in en):", extraInEs.join(", "));
} else {
  console.log(`✓ es/en key parity OK (${enKeys.size} keys)`);
}

// ── Info: coverage of the other locales vs en ───────────────────────────────
for (const loc of ["pt", "fr", "de", "it", "zh", "ja", "hi", "ko"]) {
  const k = new Set(flatten(load(loc)));
  const missing = [...enKeys].filter((x) => !k.has(x)).length;
  console.log(
    `  ${loc}: ${enKeys.size - missing}/${enKeys.size} keys (rest fall back to en)`,
  );
}

// ── (a) hardcoded strings in migrated routes ────────────────────────────────
const wordy =
  /<[A-Za-z][^>]*>\s*([A-Za-z][A-Za-z'’,.!?-]*(?:\s+[A-Za-z][A-Za-z'’,.!?-]*){2,})\s*</g;
for (const rel of MIGRATED_ROUTES) {
  const src = readFileSync(join(root, rel), "utf8");
  const hits = [];
  let m;
  while ((m = wordy.exec(src))) {
    const text = m[1].trim();
    if (!/\{|t\(/.test(m[0]) && !/^[A-Z0-9_]+$/.test(text)) hits.push(text);
  }
  if (hits.length) {
    failed = true;
    console.error(`✗ hardcoded strings in ${rel}:`, hits.slice(0, 10));
  } else {
    console.log(`✓ no hardcoded strings in ${rel}`);
  }
}

process.exit(failed ? 1 : 0);
