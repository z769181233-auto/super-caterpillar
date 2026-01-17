/**
 * CE01 (External V3.0) to CE06 (Internal Stable) Protocol Adapter
 * 
 * V3.0 Manual (CE01): { text_chunk, prev_context }
 * Internal CE06: { structured_text, context_injection }
 */

export interface CE01Input {
  text_chunk: string;
  prev_context: string;
}

export interface CE06InternalInput {
  structured_text: string;
  context_injection: {
    short_term_memory: string;
    long_term_memory?: string;
    entity_states?: any;
  };
  phase?: string;
  traceId?: string;
}

export function adaptCE01ToCE06(input: CE01Input, metadata?: any): CE06InternalInput {
  return {
    structured_text: input.text_chunk,
    context_injection: {
      short_term_memory: input.prev_context,
      // Long-term memory and entity states are handled by the processor's buildContext helper
    },
    phase: 'CHUNK_PARSE',
    traceId: metadata?.traceId,
  };
}
