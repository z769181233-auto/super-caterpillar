"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nlp_base_1 = require("../nlp_base");
class TestNlpEngine extends nlp_base_1.NlpBaseEngine {
    constructor(cache, audit, cost) {
        super('test_engine', cache, audit, cost);
    }
    async invoke(input) {
        return this.execute(input, input.payload);
    }
    async processLogic(payload) {
        return { detected: payload.text.toUpperCase() };
    }
}
describe('NlpBaseEngine', () => {
    let engine;
    let mockCache;
    let mockAudit;
    let mockCost;
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
        const input = {
            payload: { text: 'hello' },
            context: { projectId: 'p1', userId: 'u1', jobId: 'j1', traceId: 't1' },
            engineKey: 'test',
            jobType: 'NOVEL_ANALYSIS',
        };
        const result = await engine.execute(input, input.payload);
        expect(result.status).toBe('SUCCESS');
        expect(result.output.status).toBe('PASS');
        expect(result.output.analysis.detected).toBe('HELLO');
        expect(result.output.meta.source).toBe('generated');
        expect(mockCache.set).toHaveBeenCalled();
        expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ details: expect.objectContaining({ cache: 'MISS' }) }));
        expect(mockCost.recordFromEvent).toHaveBeenCalledWith(expect.objectContaining({ costAmount: 1 }));
    });
    it('should return cached result on cache hit', async () => {
        const input = {
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
        expect(result.output.analysis.detected).toBe('HI');
        expect(result.output.meta.source).toBe('cache');
        expect(mockCost.recordFromEvent).toHaveBeenCalledWith(expect.objectContaining({ costAmount: 0 }));
    });
});
//# sourceMappingURL=nlp_base.spec.js.map