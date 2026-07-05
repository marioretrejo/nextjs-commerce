#!/usr/bin/env node
/**
 * Design-system audit (Task 5 gate).
 *
 * The product design system is intentionally monochrome: white (#ffffff),
 * near-black (#0a0a0a), and a small grey ramp (#f5f5f5 / #e0e0e0 / #6b6b6b),
 * all declared as tokens in app/globals.css. Urgency and status are conveyed
 * with weight, inversion, and iconography — NOT hue.
 *
 * This audit scans the files listed in AUDITED_FILES for Tailwind colour-hue
 * utilities (bg-blue-600, text-amber-800, border-green-200, …). Any hit fails.
 * As components are restyled to B&W they get added here and the scan keeps them
 * from regressing — the same allowlist pattern as scripts/i18n-audit.mjs.
 *
 * The single sanctioned non-monochrome token is `destructive` (#dc2626) for
 * genuine error/danger surfaces; it is expressed via the `destructive` token
 * classes, never a raw `*-red-*` utility, so it does not trip this scan.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Components/routes whose colour has been migrated to the monochrome system.
// Add files here as they are restyled; the scan keeps them clean.
const AUDITED_FILES = ["components/billing/ActivationBanner.tsx"];

// Tailwind hue families that are off-palette for a monochrome design system.
const HUES = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
];

// e.g. bg-blue-600, hover:text-amber-800, border-green-200, ring-sky-500/50
const UTILITY = new RegExp(
  `\\b(?:[a-z-]+:)*(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|accent|caret|decoration|placeholder|shadow)-(?:${HUES.join(
    "|",
  )})-\\d{2,3}\\b`,
  "g",
);

let failed = false;

for (const rel of AUDITED_FILES) {
  const src = readFileSync(join(root, rel), "utf8");
  const hits = [...src.matchAll(UTILITY)].map((m) => m[0]);
  if (hits.length) {
    failed = true;
    console.error(
      `✗ off-palette colour utilities in ${rel}:`,
      [...new Set(hits)].join(", "),
    );
  } else {
    console.log(`✓ ${rel} is monochrome`);
  }
}

console.log(
  `\n${AUDITED_FILES.length} file(s) audited against the B&W design system.`,
);
process.exit(failed ? 1 : 0);
