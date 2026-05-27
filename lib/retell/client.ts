import Retell from 'retell-sdk';

let _client: Retell | null = null;

export function getRetellClient(): Retell {
  const apiKey = process.env['RETELL_API_KEY'];
  if (!apiKey) throw new Error('RETELL_API_KEY is not set');
  if (!_client) _client = new Retell({ apiKey });
  return _client;
}

// Convenience shim so existing route files don't need rewrites.
// Each method delegates to the official Retell SDK (correct endpoints).
export const retell = {
  async createWebCall(agentId: string) {
    return getRetellClient().call.createWebCall({ agent_id: agentId });
  },

  async createPhoneCall(config: {
    from_number: string;
    to_number: string;
    agent_id?: string;
    metadata?: Record<string, unknown>;
    retell_llm_dynamic_variables?: Record<string, string>;
  }) {
    type PhoneCallBody = Parameters<ReturnType<typeof getRetellClient>['call']['createPhoneCall']>[0];
    return getRetellClient().call.createPhoneCall(config as PhoneCallBody);
  },

  async updateAgent(agentId: string, config: {
    agent_name?: string;
    voice_id?: string;
    language?: string;
    interruption_sensitivity?: number;
    voicemail_option?: { action: { type: 'hangup' } | { type: 'static_text'; text: string } } | null;
  }) {
    return getRetellClient().agent.update(agentId, config as Parameters<ReturnType<typeof getRetellClient>['agent']['update']>[1]);
  },

  async deleteAgent(agentId: string) {
    return getRetellClient().agent.delete(agentId);
  },

  async batchCall(config: {
    from_number: string;
    tasks: { from_number: string; to_number: string; metadata?: Record<string, unknown>; retell_llm_dynamic_variables?: Record<string, string> }[];
    name?: string;
    max_concurrent_calls?: number;
  }) {
    type BatchBody = Parameters<ReturnType<typeof getRetellClient>['batchCall']['createBatchCall']>[0];
    return getRetellClient().batchCall.createBatchCall(config as BatchBody);
  },
};
