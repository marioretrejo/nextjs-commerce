export function sanitizeAgentForClient(agent: Record<string, unknown>) {
  const {
    voice_engine_internal,
    telephony_provider_id,
    internal_provider,
    ...safe
  } = agent;
  void voice_engine_internal;
  void telephony_provider_id;
  void internal_provider;
  return safe;
}

export function sanitizeCallForClient(call: Record<string, unknown>) {
  const {
    internal_provider,
    routing_data,
    provider_cost,
    cost_usd,
    imported_payload,
    ...safe
  } = call;
  void internal_provider;
  void routing_data;
  void provider_cost;
  void cost_usd;
  // imported_payload can be large and is only needed on the detail view — omit
  // it from list responses.
  void imported_payload;
  return safe;
}
