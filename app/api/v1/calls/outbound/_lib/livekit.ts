import { RoomServiceClient } from "livekit-server-sdk";

export interface OutboundAgent {
  id: string;
  name: string;
  system_prompt: string | null;
  first_message: string | null;
  voice_id: string | null;
  voice_emotion: string | null;
}

interface LivekitCreds {
  httpUrl: string;
  apiKey: string;
  apiSecret: string;
}

// Create the LiveKit room the worker will auto-join, with agent metadata.
export async function createOutboundRoom(
  creds: LivekitCreds,
  opts: {
    roomName: string;
    agent: OutboundAgent;
    workspaceId: string;
    variables: Record<string, unknown>;
    to: string;
  },
): Promise<void> {
  const { httpUrl, apiKey, apiSecret } = creds;
  const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
  await roomService.createRoom({
    name: opts.roomName,
    metadata: JSON.stringify({
      agent_name: opts.agent.name,
      system_prompt: opts.agent.system_prompt,
      first_message: opts.agent.first_message,
      voice_id: opts.agent.voice_id,
      voice_emotion: opts.agent.voice_emotion,
      workspace_id: opts.workspaceId,
      call_direction: "outbound",
      dynamic_variables: opts.variables,
      recipient_number: opts.to,
    }),
    departureTimeout: 600,
  });
}

// Native LiveKit outbound SIP fallback (used when Twilio creds are absent).
// Returns the created participant identity.
export async function createOutboundSipParticipant(
  creds: LivekitCreds,
  opts: {
    outboundTrunkId: string;
    to: string;
    roomName: string;
    fromNumber?: string;
  },
): Promise<string> {
  const { httpUrl, apiKey, apiSecret } = creds;
  const { SipClient } = await import("livekit-server-sdk");
  const sipClient = new SipClient(httpUrl, apiKey, apiSecret);
  const sipP = await sipClient.createSipParticipant(
    opts.outboundTrunkId,
    opts.to,
    opts.roomName,
    {
      participantIdentity: `sip_out_${Date.now()}`,
      participantName: "Caller",
      ...(opts.fromNumber ? { fromNumber: opts.fromNumber } : {}),
      playDialtone: true,
      waitUntilAnswered: false,
    },
  );
  return sipP.participantIdentity;
}
