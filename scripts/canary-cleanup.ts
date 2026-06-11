import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const admin = createClient(
  process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
  process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
  { auth: { persistSession: false } },
);

const toDelete = [
  "c4a0deef-84c1-4517-af86-da18f9426d64",
  "a50cc916-34db-488f-a69a-c04ea071b293",
];

async function cleanup() {
  for (const id of toDelete) {
    const { error } = await admin.from("campaigns").delete().eq("id", id);
    console.log(`delete ${id}:`, error ? error.message : "ok");
  }
}

cleanup().catch(console.error);
