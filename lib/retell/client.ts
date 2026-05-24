const RETELL_BASE = 'https://api.retellai.com';

function headers() {
  return {
    Authorization: `Bearer ${process.env['RETELL_API_KEY']}`,
    'Content-Type': 'application/json'
  };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${RETELL_BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Retell API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface RetellAgentConfig {
  agent_name?: string;
  response_engine: { type: 'retell-llm'; llm_id: string };
  voice_id: string;
  language?: string;
  interruption_sensitivity?: number;
  enable_backchannel?: boolean;
  ambient_sound?: string;
  post_call_analysis_data?: RetellPostCallField[];
}

export interface RetellPostCallField {
  name: string;
  description: string;
  type: 'string' | 'enum' | 'boolean' | 'number';
  examples?: string[];
}

export interface RetellLLMConfig {
  model?: string;
  general_prompt?: string;
  begin_message?: string;
  general_tools?: unknown[];
  states?: unknown[];
  starting_state?: string;
  default_dynamic_variables?: Record<string, string>;
}

export interface RetellPhone {
  phone_number: string;
  inbound_agent_id?: string;
  outbound_agent_id?: string;
  nickname?: string;
}

export interface RetellCallResponse {
  call_id: string;
  call_status: string;
  agent_id: string;
  call_type: string;
  access_token?: string;
}

export interface RetellBatchCallTask {
  from_number: string;
  to_number: string;
  override_agent_id?: string;
  metadata?: Record<string, unknown>;
  retell_llm_dynamic_variables?: Record<string, string>;
}

// LLM
export const retell = {
  async createLLM(config: RetellLLMConfig) {
    return request<{ llm_id: string }>('POST', '/v2/create-retell-llm', config);
  },
  async updateLLM(llmId: string, config: Partial<RetellLLMConfig>) {
    return request<{ llm_id: string }>('PATCH', `/v2/update-retell-llm/${llmId}`, config);
  },
  async deleteLLM(llmId: string) {
    return request<void>('DELETE', `/v2/delete-retell-llm/${llmId}`);
  },

  // Agents
  async createAgent(config: RetellAgentConfig) {
    return request<{ agent_id: string }>('POST', '/v2/create-agent', config);
  },
  async updateAgent(agentId: string, config: Partial<RetellAgentConfig>) {
    return request<{ agent_id: string }>('PATCH', `/v2/update-agent/${agentId}`, config);
  },
  async deleteAgent(agentId: string) {
    return request<void>('DELETE', `/v2/delete-agent/${agentId}`);
  },
  async getAgent(agentId: string) {
    return request<RetellAgentConfig & { agent_id: string }>('GET', `/v2/get-agent/${agentId}`);
  },

  // Phone numbers
  async listPhoneNumbers() {
    return request<RetellPhone[]>('GET', '/v2/list-phone-numbers');
  },
  async assignPhoneNumber(phoneNumber: string, config: Partial<RetellPhone>) {
    return request<RetellPhone>('PATCH', `/v2/update-phone-number/${phoneNumber}`, config);
  },
  async importPhoneNumber(config: { phone_number: string; termination_uri?: string }) {
    return request<RetellPhone>('POST', '/v2/import-phone-number', config);
  },

  // Calls
  async createWebCall(agentId: string) {
    return request<RetellCallResponse>('POST', '/v2/create-web-call', { agent_id: agentId });
  },
  async createPhoneCall(config: {
    from_number: string;
    to_number: string;
    agent_id?: string;
    metadata?: Record<string, unknown>;
    retell_llm_dynamic_variables?: Record<string, string>;
  }) {
    return request<RetellCallResponse>('POST', '/v2/create-phone-call', config);
  },
  async batchCall(config: {
    from_number: string;
    tasks: RetellBatchCallTask[];
    name?: string;
    scheduled_timestamp?: number;
    max_concurrent_calls?: number;
  }) {
    return request<{ batch_call_id: string }>('POST', '/v2/create-batch-call', config);
  },
  async getCall(callId: string) {
    return request<Record<string, unknown>>('GET', `/v2/get-call/${callId}`);
  }
};
