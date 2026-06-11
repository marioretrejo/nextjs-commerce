import * as dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const TWILIO_SID = process.env["TWILIO_ACCOUNT_SID"]!;
const TWILIO_AUTH = process.env["TWILIO_AUTH_TOKEN"]!;
const CALL_SID = "CA6c5c165bc817e500ac34d1e8b0fa9105";

async function main() {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls/${CALL_SID}.json`,
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64"),
      },
    },
  );
  const d = (await res.json()) as Record<string, unknown>;
  console.log("Twilio call status:");
  console.log("  sid         :", d["sid"]);
  console.log("  status      :", d["status"]);
  console.log("  direction   :", d["direction"]);
  console.log("  duration    :", d["duration"], "s");
  console.log("  to          :", d["to"]);
  console.log("  from        :", d["from"]);
  console.log("  answered_by :", d["answered_by"] ?? "—");
  console.log("  start_time  :", d["start_time"]);
  console.log("  end_time    :", d["end_time"]);
  console.log("  error_code  :", d["error_code"] ?? "none");
  console.log("  error_msg   :", d["error_message"] ?? "none");
}
main().catch(console.error);
