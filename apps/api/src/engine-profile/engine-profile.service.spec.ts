import { Test, TestingModule } from '@nestjs/testing';
import { EngineProfileService } from './engine-profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';
import { EngineRegistryHubService } from '../engine-hub/engine-registry-hub.service';

describe('EngineProfileService', () => {
  let service: EngineProfileService;
  let prisma: PrismaService;
  let jobService: JobService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EngineProfileService,
        {
          provide: PrismaService,
          useValue: {
            shotJob: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: JobService,
          useValue: {
            extractEngineKeyFromJob: jest.fn(),
            extractEngineVersionFromJob: jest.fn(),
          },
        },
        {
          provide: EngineRegistryHubService,
          useValue: {
            find: jest
              .fn()
              .mockReturnValue({ mode: 'local', adapterToken: { name: 'mock_adapter' } }),
          },
        },
      ],
    }).compile();

    service = module.get<EngineProfileService>(EngineProfileService);
    prisma = module.get<PrismaService>(PrismaService);
    jobService = module.get<JobService>(JobService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfileSummary', () => {
    it('should return empty summaries when no jobs found', async () => {
      jest.spyOn(prisma.shotJob, 'findMany').mockResolvedValue([]);

      const result = await service.getProfileSummary({});

      expect(result.summaries).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should aggregate jobs by engineKey', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          type: 'NOVEL_ANALYSIS',
          status: 'SUCCEEDED',
          payload: {
            engineKey: 'default_novel_analysis',
            result: {
              quality: { score: 0.9, confidence: 0.95 },
              metrics: { durationMs: 1000, tokens: 100, costUsd: 0.01 },
            },
          },
          engineConfig: null,
          retryCount: 0,
          createdAt: new Date(),
        },
        {
          id: 'job-2',
          type: 'NOVEL_ANALYSIS',
          status: 'SUCCEEDED',
          payload: {
            engineKey: 'default_novel_analysis',
            result: {
              quality: { score: 0.8, confidence: 0.9 },
              metrics: { durationMs: 2000, tokens: 200, costUsd: 0.02 },
            },
          },
          engineConfig: null,
          retryCount: 0,
          createdAt: new Date(),
        },
      ];

      jest.spyOn(prisma.shotJob, 'findMany').mockResolvedValue(mockJobs as any);
      jest.spyOn(jobService, 'extractEngineKeyFromJob').mockReturnValue('default_novel_analysis');
      jest.spyOn(jobService, 'extractEngineVersionFromJob').mockReturnValue(null);

      const result = await service.getProfileSummary({});

      expect(result.summaries.length).toBe(1);
      expect(result.summaries[0].engineKey).toBe('default_novel_analysis');
      expect(result.summaries[0].totalJobs).toBe(2);
      expect(result.summaries[0].successCount).toBe(2);
      expect(result.summaries[0].avgQualityScore).toBeCloseTo(0.85, 2);
      expect(result.summaries[0].avgDurationMs).toBeCloseTo(1500, 2);
    });

    it('should filter by engineKey when provided', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          type: 'NOVEL_ANALYSIS',
          status: 'SUCCEEDED',
          payload: { engineKey: 'default_novel_analysis' },
          engineConfig: null,
          retryCount: 0,
          createdAt: new Date(),
        },
        {
          id: 'job-2',
          type: 'NOVEL_ANALYSIS',
          status: 'SUCCEEDED',
          payload: { engineKey: 'http_gemini_v1' },
          engineConfig: null,
          retryCount: 0,
          createdAt: new Date(),
        },
      ];

      jest.spyOn(prisma.shotJob, 'findMany').mockResolvedValue(mockJobs as any);
      jest
        .spyOn(jobService, 'extractEngineKeyFromJob')
        .mockReturnValueOnce('default_novel_analysis')
        .mockReturnValueOnce('http_gemini_v1');
      jest.spyOn(jobService, 'extractEngineVersionFromJob').mockReturnValue(null);

      const result = await service.getProfileSummary({ engineKey: 'default_novel_analysis' });

      expect(result.summaries.length).toBe(1);
      expect(result.summaries[0].engineKey).toBe('default_novel_analysis');
    });
  });
});
