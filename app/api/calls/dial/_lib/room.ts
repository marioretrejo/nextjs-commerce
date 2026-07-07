import { RoomServiceClient } from "livekit-server-sdk";

export interface DialAgent {
  id: string;
  name: string;
  system_prompt: string | null;
  first_message: string | null;
  voice_id: string | null;
  voice_emotion: string | null;
  flow_json: unknown | null;
  flow_config: unknown | null;
  transfer_number: string | null;
}

export interface LivekitCreds {
  httpUrl: string;
  apiKey: string;
  apiSecret: string;
}

// Create the LiveKit room the worker auto-joins, carrying agent + call metadata.
export async function createOutboundRoom(
  creds: LivekitCreds,
  opts: {
    roomName: string;
    agentId: string;
    agent: DialAgent;
    workspaceId: string;
    variables: Record<string, unknown>;
    to: string;
    departureTimeout: number;
  },
): Promise<void> {
  await new RoomServiceClient(
    creds.httpUrl,
    creds.apiKey,
    creds.apiSecret,
  ).createRoom({
    name: opts.roomName,
    metadata: JSON.stringify({
      agent_id: opts.agentId,
      agent_name: opts.agent.name,
      system_prompt: opts.agent.system_prompt,
      first_message: opts.agent.first_message,
      voice_id: opts.agent.voice_id,
      voice_emotion: opts.agent.voice_emotion,
      workspace_id: opts.workspaceId,
      call_direction: "outbound",
      dynamic_variables: opts.variables,
      recipient_number: opts.to,
      flow_json: opts.agent.flow_json ?? null,
      flow_config: opts.agent.flow_config ?? null,
      transfer_number: opts.agent.transfer_number ?? null,
    }),
    departureTimeout: opts.departureTimeout,
  });
}
