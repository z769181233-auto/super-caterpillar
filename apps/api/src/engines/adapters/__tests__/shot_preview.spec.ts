import { ShotPreviewFastAdapter } from '../shot_preview.fast.adapter';
import { RedisService } from '../../../redis/redis.service';
import { ShotRenderRouterAdapter } from '../shot_render_router.adapter';

describe('ShotPreviewFastAdapter', () => {
  let adapter: ShotPreviewFastAdapter;
  let redisService: RedisService;
  let routerAdapter: ShotRenderRouterAdapter;

  beforeEach(() => {
    // Mock Redis
    redisService = {
      getJson: jest.fn(),
      setJson: jest.fn(),
    } as unknown as RedisService;

    // Mock Router
    routerAdapter = {
      invoke: jest.fn(),
    } as unknown as ShotRenderRouterAdapter;

    // Mock Audit and Cost services
    const auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    } as any;
    const costLedgerService = {
      recordFromEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    adapter = new ShotPreviewFastAdapter(
      redisService,
      routerAdapter,
      auditService,
      costLedgerService
    );
  });

  it('should return cached result on HIT', async () => {
    (redisService.getJson as jest.Mock).mockResolvedValue({ some: 'data' });

    const result = await adapter.invoke({
      payload: { prompt: 'test' },
      context: {},
      engineKey: 'shot_preview',
      jobType: 'shot_render',
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
      output: {
        result: 'image',
        url: 'http://localhost:3000/mock-preview.png' // Add URL to pass schema check
      },
    });

    const result = await adapter.invoke({
      payload: { prompt: 'test' },
      context: {},
      engineKey: 'shot_preview',
      jobType: 'shot_render',
    });

    expect(result.status as any).toBe('SUCCESS');
    expect(result.output!.source).toBe('render');
    expect(redisService.setJson).toHaveBeenCalled();
    expect(routerAdapter.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          width: 256,
          height: 256,
          steps: 10,
        }),
      })
    );
  });
});
