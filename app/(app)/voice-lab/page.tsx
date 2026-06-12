import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { VoiceLabClient } from "./VoiceLabClient";

interface AgentOption {
  id: string;
  name: string;
  voice_id: string | null;
  first_message: string | null;
}

export default async function VoiceLabPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?callbackUrl=/voice-lab");

  const admin = createAdminClient();

  const { data: ws } = await admin
    .from("workspaces")
    .select("id, is_suspended, minutes_used, minutes_limit")
    .eq("owner_id", user.id)
    .single();

  if (!ws) redirect("/onboarding");

  const { data: agents } = await admin
    .from("agents")
    .select("id, name, voice_id, first_message")
    .eq("workspace_id", ws.id)
    .eq("status", "active")
    .order("name");

  const agentList = (agents ?? []) as AgentOption[];

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-1">
          Developer Tools
        </p>
        <h1
          className="text-2xl font-bold tracking-tight text-[#0a0a0a]"
          style={{ letterSpacing: "-0.02em" }}
        >
          Voice Agent Lab
        </h1>
        <p className="text-xs text-[#b0b0b0] mt-0.5">
          Test your voice agent via WebRTC — no Twilio required
        </p>
      </div>

      <VoiceLabClient
        agents={agentList}
        workspaceId={ws.id}
        isSuspended={!!(ws as { is_suspended?: boolean }).is_suspended}
        minutesUsed={Number(ws.minutes_used)}
        minutesLimit={Number(ws.minutes_limit)}
      />
    </div>
  );
}
