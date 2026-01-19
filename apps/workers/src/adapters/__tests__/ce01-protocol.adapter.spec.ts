import { CE01ProtocolAdapter } from '../ce01-protocol.adapter';

describe('CE01ProtocolAdapter', () => {
  it('should transform Bible V3.0 Input to Internal CE06', () => {
    const bibleInput = {
      text_chunk: 'Chapter 1: The Beginning',
      prev_context: 'Summary: Hero wakes up.',
      traceId: 'test-trace-123',
    };

    const internal = CE01ProtocolAdapter.toInternal(bibleInput);

    expect(internal).toHaveProperty('structured_text', 'Chapter 1: The Beginning');
    expect(internal.context_injection).toBeDefined();
    expect(internal.context_injection?.prev_context).toBe('Summary: Hero wakes up.');
    expect(internal.__protocol).toBe('CE01');
    expect(internal.__ce01).toEqual(
      expect.objectContaining({
        text_chunk: 'Chapter 1: The Beginning',
        prev_context: 'Summary: Hero wakes up.',
      })
    );
  });

  it('should pass through Internal CE06 Input without modification', () => {
    const internalInput = {
      structured_text: 'Already Internal',
      context_injection: {
        some_key: 'value',
      },
      jobType: 'CE06_NOVEL_PARSING',
    };

    const result = CE01ProtocolAdapter.toInternal(internalInput);

    expect(result.structured_text).toBe('Already Internal');
    expect(result.context_injection?.some_key).toBe('value');
    expect(result.__protocol).toBe('CE06_INTERNAL');
    // validInternalInput does NOT have 'text_chunk', so check it wasn't added mapped incorrectly
    expect(result).not.toHaveProperty('__ce01');
  });

  it('should handle null/undefined input gracefully', () => {
    const result = CE01ProtocolAdapter.toInternal(null);
    expect(result).toBeDefined();
    expect(result.__protocol).toBe('CE06_INTERNAL');
  });
});
