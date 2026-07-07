export interface AgentOption {
  id: string;
  name: string;
  voice_id: string | null;
  first_message: string | null;
}

export interface LabEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  call_id: string | null;
}

export interface VoiceLabClientProps {
  agents: AgentOption[];
  workspaceId: string;
  isSuspended: boolean;
  minutesUsed: number;
  minutesLimit: number;
}

export interface Session {
  token: string;
  wsUrl: string;
  roomName: string;
  agentName: string;
}
