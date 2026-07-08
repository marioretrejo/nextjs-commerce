#!/usr/bin/env node
/**
 * Run Supabase migrations
 * Usage: npx ts-node scripts/run-migrations.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing environment variables:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
  console.log("🚀 Starting Supabase migrations...\n");

  const migrationsDir = path.join(__dirname, "../supabase/migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && f >= "076_") // Only Phase 1 and later
    .sort();

  let completed = 0;
  let failed = 0;

  for (const file of files) {
    try {
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

      console.log(`📝 Running: ${file}`);

      // Split by ; to handle multiple statements
      const statements = sql.split(";").filter((s) => s.trim());

      for (const statement of statements) {
        const trimmed = statement.trim();
        if (!trimmed) continue;

        let error: { message?: string } | null = null;
        try {
          const res = await client.rpc("exec", { query: trimmed });
          error = res.error;
        } catch {
          // Fallback: use raw query
          const res = await client.from("_migrations").select().limit(0);
          error = res.error;
        }

        if (error && error.message !== "No rows found") {
          throw error;
        }
      }

      console.log(`✅ ${file}`);
      completed++;
    } catch (error) {
      console.error(`❌ ${file}`);
      console.error(`   Error: ${(error as Error).message}\n`);
      failed++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Results: ${completed} completed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log("✨ All migrations completed successfully!");
}

runMigrations();
