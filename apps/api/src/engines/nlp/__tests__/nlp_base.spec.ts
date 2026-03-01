import { NlpBaseEngine } from '../nlp_base';
import { NlpCache } from '../nlp_cache';
import { AuditService } from '../../../audit/audit.service';
import { CostLedgerService } from '../../../cost/cost-ledger.service';
import { EngineInvokeInput } from '@scu/shared-types';

class TestNlpEngine extends NlpBaseEngine {
  constructor(cache: any, audit: any, cost: any) {
    super('test_engine', cache, audit, cost);
  }
  async invoke(input: any): Promise<any> {
    return this.execute(input, input.payload);
  }
  protected async processLogic(payload: any): Promise<any> {
    return { detected: payload.text.toUpperCase() };
  }
}

describe('NlpBaseEngine', () => {
  let engine: TestNlpEngine;
  let mockCache: any;
  let mockAudit: any;
  let mockCost: any;

  beforeEach(() => {
    mockCache = {
      generateKey: jest.fn().mockReturnValue('mock_key'),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
    };
    mockAudit = { log: jest.fn().mockResolvedValue(true) };
    mockCost = { recordFromEvent: jest.fn().mockResolvedValue(true) };
    engine = new TestNlpEngine(mockCache, mockAudit, mockCost);
  });

  it('should execute logic and return standard output on cache miss', async () => {
    const input: EngineInvokeInput = {
      payload: { text: 'hello' },
      context: { projectId: 'p1', userId: 'u1', jobId: 'j1', traceId: 't1' },
      engineKey: 'test',
      jobType: 'NOVEL_ANALYSIS',
    };

    const result = await engine.execute(input, input.payload);

    expect(result.status).toBe('SUCCESS');
    expect(result.output!.status).toBe('PASS');
    expect(result.output!.analysis.detected).toBe('HELLO');
    expect(result.output!.meta.source).toBe('generated');

    expect(mockCache.set).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({ details: expect.objectContaining({ cache: 'MISS' }) })
    );
    expect(mockCost.recordFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({ costAmount: 1 })
    );
  });

  it('should return cached result on cache hit', async () => {
    const input: EngineInvokeInput = {
      payload: { text: 'hello' },
      context: { projectId: 'p1', userId: 'u1', jobId: 'j1', traceId: 't1' },
      engineKey: 'test',
      jobType: 'NOVEL_ANALYSIS',
    };

    mockCache.get.mockResolvedValue({
      status: 'PASS',
      analysis: { detected: 'HI' },
      metrics: { chars: 2 },
      meta: { source: 'generated' },
    });

    const result = await engine.execute(input, input.payload);

    expect(result.output!.analysis.detected).toBe('HI');
    expect(result.output!.meta.source).toBe('cache');
    expect(mockCost.recordFromEvent).toHaveBeenCalledWith(
      expect.objectContaining({ costAmount: 0 })
    );
  });
});
