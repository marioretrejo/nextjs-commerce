#!/usr/bin/env node
/**
 * Deploy QA Center v2 Phase 1 migrations to Supabase
 * Direct PostgreSQL connection using postgres:// URL
 * Usage: SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=... node scripts/deploy-migrations.js
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ Missing environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL");
  console.error("   SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Parse Supabase URL to get project ID
const urlObj = new URL(SUPABASE_URL);
const projectId = urlObj.hostname.split(".")[0];
const dbUrl = `postgresql://postgres:${SERVICE_KEY}@${projectId}.supabase.co:5432/postgres`;

console.log(`🔗 Supabase Project: ${projectId}`);
console.log(`📍 URL: ${SUPABASE_URL}\n`);

// Find migrations
const migrationsDir = path.join(__dirname, "../supabase/migrations");
const migrationFiles = [
  "076_qa_customer_journeys.sql",
  "077_qa_departments.sql",
  "078_qa_forbidden_rules.sql",
  "079_qa_alerts.sql",
  "080_qa_transcript_segments.sql",
  "081_qa_roles_and_permissions.sql",
].map((f) => path.join(migrationsDir, f));

console.log(`📊 Found ${migrationFiles.length} migrations\n`);

// Function to execute SQL via REST API (workaround for direct connection)
async function executeSql(sql, description) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query: sql });

    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: "/rest/v1/",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Length": payload.length,
        // Try to execute as raw SQL - some endpoints might support it
        "X-Raw-SQL": "true",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        // REST API won't work for DDL, but we'll try other methods
        resolve({ status: res.statusCode, data });
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// Alternative: Use JavaScript PostgreSQL client (more reliable)
async function deployViaNative() {
  console.log("Attempting deployment via PostgreSQL native connection...\n");

  // For this approach, we'd need to install pg module
  // Try-catch to handle if pg is not installed
  try {
    const { Client } = require("pg");

    const client = new Client({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    console.log("✅ Connected to PostgreSQL\n");

    let completed = 0;
    let failed = 0;

    for (const filePath of migrationFiles) {
      const filename = path.basename(filePath);
      try {
        console.log(`📝 Executing: ${filename}`);

        const sql = fs.readFileSync(filePath, "utf-8");

        // Execute as single transaction
        await client.query("BEGIN");

        // Split statements and execute
        const statements = sql
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith("--"));

        for (const statement of statements) {
          await client.query(statement);
        }

        await client.query("COMMIT");

        console.log(`✅ ${filename}\n`);
        completed++;
      } catch (error) {
        console.error(`❌ ${filename}`);
        console.error(`   Error: ${error.message}\n`);
        failed++;

        // Try to rollback on error
        try {
          await client.query("ROLLBACK");
        } catch (e) {}
      }
    }

    await client.end();

    console.log("=".repeat(50));
    console.log(`📊 Results: ${completed} completed, ${failed} failed`);

    if (failed > 0) {
      process.exit(1);
    }

    console.log("✨ All migrations deployed successfully!\n");
    console.log("🚀 Next step: Render will auto-deploy from GitHub");
    console.log(`📍 Check: https://voiceos-app.onrender.com/qa-center\n`);
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") {
      console.error("❌ PostgreSQL client not installed");
      console.error("   Install with: npm install pg\n");
      console.error("📌 Manual Alternative:");
      console.error(
        "   1. Go to https://supabase.com/dashboard/project/" +
          projectId +
          "/sql/new",
      );
      console.error("   2. Copy each SQL file (076-081) and execute");
      console.error(
        "   3. Verify: SELECT COUNT(*) FROM qa_roles WHERE is_system = true; (should return 5)\n",
      );
      process.exit(1);
    }

    console.error("❌ Connection error:", error.message);
    process.exit(1);
  }
}

// Start deployment
deployViaNative().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
