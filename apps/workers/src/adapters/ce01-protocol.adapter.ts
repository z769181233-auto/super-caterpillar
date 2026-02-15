/**
 * CE01 Protocol Adapter (Bible V3.0 -> Internal CE06)
 *
 * Implements strict type mapping from "The Caterpillar Implementation Bible V3.0"
 * to internal production schemas (CE06_NOVEL_PARSING).
 *
 * NON-DESTRUCTIVE:
 * - Only transforms input.
 * - Does not modify internal entity definitions.
 * - Preserves payload if already in internal format.
 */

export type BibleCE01Input = {
  text_chunk: string;
  prev_context?: string;
  // Optional traceId for consistency, though usually in job root
  traceId?: string;
  [k: string]: unknown;
};

export type BibleCE01Scene = {
  start_line: number;
  end_line: number;
  location: string;
  characters: string[];
  events: string;
};

export type BibleCE01Output = {
  scenes: BibleCE01Scene[];
};

// Internal Structure based on grep analysis of CE06 processor
export type InternalCE06Input = {
  raw_text?: string; // Used by executeScanJob
  structured_text?: string; // Used by CE06 engine invocation
  context_injection?: {
    prev_context?: string;
    [k: string]: unknown;
  };
  jobType?: string;
  [k: string]: unknown;
};

// Type Guard
export function isBibleCE01Input(x: any): x is BibleCE01Input {
  return !!x && typeof x === 'object' && typeof x.text_chunk === 'string';
}

export class CE01ProtocolAdapter {
  /**
   * Normalize input to Internal CE06 format.
   * If input matches Bible V3.0 Protocol, transforms it.
   * Otherwise, assumes it is already internal format (or legacy) and passes through.
   */
  static toInternal(input: any): InternalCE06Input {
    // 1. Bible Protocol -> Internal CE06
    if (isBibleCE01Input(input)) {
      const textChunk = input.text_chunk;
      const prev = input.prev_context ?? '';

      return {
        // Map 'text_chunk' -> 'raw_text' (for Processor Logic) AND 'structured_text' (for consistency)
        rawText: textChunk,
        structured_text: textChunk,

        // Map 'prev_context' -> 'context_injection.prev_context' (Production Field)
        context_injection: {
          prev_context: prev,
        },

        // Preserve other keys just in case, but prioritize the mapping
        ...input,

        // Evidence Marking for Gate 13
        __protocol: 'CE01',
        __ce01: {
          text_chunk: textChunk,
          prev_context: prev,
        },
      } as InternalCE06Input;
    }

    // 2. Internal Pass-through
    // Ensure we don't double-wrap or break existing internal payloads
    return {
      ...(input ?? {}),
      __protocol: input?.__protocol ?? 'CE06_INTERNAL',
    };
  }
}
