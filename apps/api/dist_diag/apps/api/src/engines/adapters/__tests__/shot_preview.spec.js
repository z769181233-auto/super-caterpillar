"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5432/testdb';
process.env.JWT_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.REDIS_URL = 'redis://127.0.0.1:6379';
const shot_preview_fast_adapter_1 = require("../shot_preview.fast.adapter");
describe('ShotPreviewFastAdapter', () => {
    let adapter;
    let redisService;
    let routerAdapter;
    beforeEach(() => {
        redisService = {
            getJson: jest.fn(),
            setJson: jest.fn(),
        };
        routerAdapter = {
            invoke: jest.fn(),
        };
        const auditService = {
            log: jest.fn().mockResolvedValue(undefined),
        };
        const costLedgerService = {
            recordFromEvent: jest.fn().mockResolvedValue(undefined),
        };
        adapter = new shot_preview_fast_adapter_1.ShotPreviewFastAdapter(redisService, routerAdapter, auditService, costLedgerService);
    });
    it('should return cached result on HIT', async () => {
        redisService.getJson.mockResolvedValue({ some: 'data' });
        const result = await adapter.invoke({
            payload: { prompt: 'test' },
            context: {},
            engineKey: 'shot_preview',
            jobType: 'shot_render',
        });
        expect(result.status).toBe('SUCCESS');
        expect(result.output.source).toBe('cache');
        expect(result.output.some).toBe('data');
        expect(redisService.getJson).toHaveBeenCalled();
        expect(routerAdapter.invoke).not.toHaveBeenCalled();
    });
    it('should render and cache on MISS', async () => {
        redisService.getJson.mockResolvedValue(null);
        routerAdapter.invoke.mockResolvedValue({
            status: 'SUCCESS',
            output: {
                result: 'image',
                url: 'http://localhost:3000/mock-preview.png'
            },
        });
        const result = await adapter.invoke({
            payload: { prompt: 'test' },
            context: {},
            engineKey: 'shot_preview',
            jobType: 'shot_render',
        });
        expect(result.status).toBe('SUCCESS');
        expect(result.output.source).toBe('render');
        expect(redisService.setJson).toHaveBeenCalled();
        expect(routerAdapter.invoke).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({
                width: 256,
                height: 256,
                steps: 10,
            }),
        }));
    });
});
//# sourceMappingURL=shot_preview.spec.js.map