#!/usr/bin/env node
/**
 * Execute Supabase migrations using SQL
 * Usage: node scripts/migrate.js
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing environment variables");
  process.exit(1);
}

// Parse migrations
const migrationsDir = path.join(__dirname, "../supabase/migrations");
const migrations = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql") && f >= "076_")
  .sort();

console.log(`📊 Found ${migrations.length} migrations\n`);

// Execute each migration
async function executeMigration(file) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      query: sql,
    });

    const url = new URL(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Length": data.length,
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          resolve();
        } else {
          reject(new Error(`Status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// Alternative: Use psql directly if available
async function executeMigrationViaPsql(file) {
  const { spawn } = require("child_process");
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

  const url = new URL(SUPABASE_URL);
  const dbUrl = `postgresql://postgres:${SERVICE_KEY}@${url.hostname}/postgres`;

  return new Promise((resolve, reject) => {
    const proc = spawn("psql", [dbUrl], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdin.write(sql);
    proc.stdin.end();

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => (stdout += data));
    proc.stderr.on("data", (data) => (stderr += data));

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`psql error: ${stderr}`));
      }
    });
  });
}

async function runMigrations() {
  let completed = 0;
  let failed = 0;

  for (const file of migrations) {
    try {
      console.log(`📝 Running: ${file}`);

      // Try psql first, fallback to REST API
      try {
        await executeMigrationViaPsql(file);
      } catch (psqlError) {
        console.log(`   (psql not available, trying REST API)`);
        await executeMigration(file);
      }

      console.log(`✅ ${file}\n`);
      completed++;
    } catch (error) {
      console.error(`❌ ${file}`);
      console.error(`   Error: ${error.message}\n`);
      failed++;
    }
  }

  console.log("=".repeat(50));
  console.log(`📊 Results: ${completed} completed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log("✨ All migrations completed!");
}

runMigrations().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
