import { ShotPreviewFastAdapter } from '../shot_preview.fast.adapter';
import { RedisService } from '../../../redis/redis.service';
import { ShotRenderRouterAdapter } from '../shot-render.router.adapter';

describe('ShotPreviewFastAdapter', () => {
    let adapter: ShotPreviewFastAdapter;
    let redisService: RedisService;
    let routerAdapter: ShotRenderRouterAdapter;

    beforeEach(() => {
        // Mock Redis
        redisService = {
            getJson: jest.fn(),
            setJson: jest.fn()
        } as unknown as RedisService;

        // Mock Router
        routerAdapter = {
            invoke: jest.fn()
        } as unknown as ShotRenderRouterAdapter;

        adapter = new ShotPreviewFastAdapter(redisService, routerAdapter);
    });

    it('should return cached result on HIT', async () => {
        (redisService.getJson as jest.Mock).mockResolvedValue({ some: 'data' });

        const result = await adapter.invoke({
            payload: { prompt: 'test' },
            context: {},
            engineKey: 'shot_preview',
            jobType: 'shot_render'
        });

        expect(result.status as any).toBe('SUCCESS');
        expect(result.output!.source).toBe('cache');
        expect(result.output!.some).toBe('data');
        expect(redisService.getJson).toHaveBeenCalled();
        expect(routerAdapter.invoke).not.toHaveBeenCalled();
    });

    it('should render and cache on MISS', async () => {
        (redisService.getJson as jest.Mock).mockResolvedValue(null);
        (routerAdapter.invoke as jest.Mock).mockResolvedValue({
            status: 'SUCCESS', // Enum removed, using string
            output: { result: 'image' }
        });

        const result = await adapter.invoke({
            payload: { prompt: 'test' },
            context: {},
            engineKey: 'shot_preview',
            jobType: 'shot_render'
        });

        expect(result.status as any).toBe('SUCCESS');
        expect(result.output!.source).toBe('render');
        expect(redisService.setJson).toHaveBeenCalled();
        expect(routerAdapter.invoke).toHaveBeenCalledWith(expect.objectContaining({
            payload: expect.objectContaining({
                width: 256,
                height: 256,
                steps: 10
            })
        }));
    });
});
