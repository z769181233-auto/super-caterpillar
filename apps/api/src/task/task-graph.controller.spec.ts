/**
 * S3-C.3 Phase 1 Finalization: Task Graph Controller 最小单元测试
 *
 * 测试目标：验证 Task Graph API 返回的引擎信息、质量指标、性能指标字段符合 TaskGraphWithEngineInfo 类型
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TaskGraphController } from './task-graph.controller';
import { TaskGraphService } from './task-graph.service';
import { QualityScoreService } from '../quality/quality-score.service';
import { QualityFeedbackService } from '../quality/quality-feedback.service';
import { EngineRegistry } from '../engine/engine-registry.service';
import { EngineConfigStoreService } from '../engine/engine-config-store.service';
import { PrismaService } from '../prisma/prisma.service';
import { JobService } from '../job/job.service';

describe('TaskGraphController - S3-C.3 Phase 1', () => {
  let controller: TaskGraphController;
  let taskGraphService: TaskGraphService;
  let prismaService: PrismaService;
  let jobService: JobService;

  const mockTaskGraphService = {
    findTaskGraph: jest.fn(),
  };

  const mockPrismaService = {
    shotJob: {
      findMany: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
    },
  };

  const mockJobService = {
    extractEngineKeyFromJob: jest.fn(),
    extractEngineVersionFromJob: jest.fn(),
  };

  const mockQualityScoreService = {
    buildQualityScoreFromJob: jest.fn(),
  };

  const mockQualityFeedbackService = {
    evaluateQualityScores: jest.fn(),
  };

  const mockEngineRegistry = {
    getAdapter: jest.fn(),
  };

  const mockEngineConfigStore = {
    findByEngineKey: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskGraphController],
      providers: [
        { provide: TaskGraphService, useValue: mockTaskGraphService },
        { provide: QualityScoreService, useValue: mockQualityScoreService },
        { provide: QualityFeedbackService, useValue: mockQualityFeedbackService },
        { provide: EngineRegistry, useValue: mockEngineRegistry },
        { provide: EngineConfigStoreService, useValue: mockEngineConfigStore },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JobService, useValue: mockJobService },
      ],
    }).compile();

    controller = module.get<TaskGraphController>(TaskGraphController);
    taskGraphService = module.get<TaskGraphService>(TaskGraphService);
    prismaService = module.get<PrismaService>(PrismaService);
    jobService = module.get<JobService>(JobService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getTaskGraph - 引擎信息字段验证', () => {
    it('应该返回包含完整引擎信息的 Job 节点（有 payload.engineKey 和 payload.engineVersion）', async () => {
      const taskId = 'test-task-id';
      const mockGraph = {
        taskId,
        projectId: 'test-project-id',
        taskType: 'NOVEL_ANALYSIS',
        status: 'SUCCEEDED',
        jobs: [
          {
            jobId: 'job-1',
            jobType: 'NOVEL_ANALYSIS',
            status: 'SUCCEEDED',
            attempts: 1,
            retryCount: 0,
            maxRetry: null,
            createdAt: '2025-12-11T00:00:00Z',
            startedAt: '2025-12-11T00:01:00Z',
            finishedAt: '2025-12-11T00:02:00Z',
          },
        ],
      };

      const mockRawJob = {
        id: 'job-1',
        type: 'NOVEL_ANALYSIS',
        payload: {
          engineKey: 'http_gemini_v1',
          engineVersion: 'v1.0',
          result: {
            quality: {
              score: 0.85,
              confidence: 0.9,
            },
            metrics: {
              durationMs: 2000,
              costUsd: 0.001,
              tokens: 1000,
            },
          },
        },
      };

      const mockQualityScore = {
        taskId,
        jobId: 'job-1',
        engineKey: 'http_gemini_v1',
        adapterName: 'http',
        quality: {
          score: 0.85,
          confidence: 0.9,
        },
        metrics: {
          durationMs: 2000,
          costUsd: 0.001,
          tokens: 1000,
        },
      };

      mockTaskGraphService.findTaskGraph.mockResolvedValue(mockGraph);
      mockPrismaService.shotJob.findMany.mockResolvedValue([mockRawJob]);
      mockJobService.extractEngineKeyFromJob.mockReturnValue('http_gemini_v1');
      mockJobService.extractEngineVersionFromJob.mockReturnValue('v1.0');
      mockEngineRegistry.getAdapter.mockReturnValue({ name: 'http' });
      mockQualityScoreService.buildQualityScoreFromJob.mockReturnValue(mockQualityScore);
      mockQualityFeedbackService.evaluateQualityScores.mockReturnValue({
        avgScore: 0.85,
        avgConfidence: 0.9,
        total: 1,
      });

      const result = await controller.getTaskGraph(taskId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.jobs).toHaveLength(1);

      const job = result.data?.jobs[0];
      expect(job).toBeDefined();
      // 验证引擎信息字段
      expect(job.engineKey).toBe('http_gemini_v1');
      expect(job.engineVersion).toBe('v1.0');
      expect(job.adapterName).toBe('http');
      // 验证质量指标字段
      expect(job.qualityScore).toBeDefined();
      expect(job.qualityScore.score).toBe(0.85);
      expect(job.qualityScore.confidence).toBe(0.9);
      // 验证性能指标字段
      expect(job.metrics).toBeDefined();
      expect(job.metrics.durationMs).toBe(2000);
      expect(job.metrics.costUsd).toBe(0.001);
      expect(job.metrics.tokens).toBe(1000);
    });

    it('应该返回包含默认引擎信息的 Job 节点（没有显式 engineKey）', async () => {
      const taskId = 'test-task-id';
      const mockGraph = {
        taskId,
        projectId: 'test-project-id',
        taskType: 'NOVEL_ANALYSIS',
        status: 'SUCCEEDED',
        jobs: [
          {
            jobId: 'job-2',
            jobType: 'NOVEL_ANALYSIS',
            status: 'SUCCEEDED',
            attempts: 1,
            retryCount: 0,
            maxRetry: null,
            createdAt: '2025-12-11T00:00:00Z',
            startedAt: '2025-12-11T00:01:00Z',
            finishedAt: '2025-12-11T00:02:00Z',
          },
        ],
      };

      const mockRawJob = {
        id: 'job-2',
        type: 'NOVEL_ANALYSIS',
        payload: {
          // 没有显式 engineKey
          result: {
            quality: {
              score: 0.75,
              confidence: 0.8,
            },
          },
        },
      };

      const mockQualityScore = {
        taskId,
        jobId: 'job-2',
        engineKey: 'default_novel_analysis',
        adapterName: 'default_novel_analysis',
        quality: {
          score: 0.75,
          confidence: 0.8,
        },
        metrics: {},
      };

      mockTaskGraphService.findTaskGraph.mockResolvedValue(mockGraph);
      mockPrismaService.shotJob.findMany.mockResolvedValue([mockRawJob]);
      mockJobService.extractEngineKeyFromJob.mockReturnValue('default_novel_analysis');
      mockJobService.extractEngineVersionFromJob.mockReturnValue(null);
      mockEngineRegistry.getAdapter.mockReturnValue({ name: 'default_novel_analysis' });
      mockQualityScoreService.buildQualityScoreFromJob.mockReturnValue(mockQualityScore);
      mockQualityFeedbackService.evaluateQualityScores.mockReturnValue({
        avgScore: 0.75,
        avgConfidence: 0.8,
        total: 1,
      });

      const result = await controller.getTaskGraph(taskId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const job = result.data?.jobs[0];
      expect(job).toBeDefined();
      // 验证默认引擎信息
      expect(job.engineKey).toBe('default_novel_analysis');
      expect(job.engineVersion).toBe(null);
      expect(job.adapterName).toBe('default_novel_analysis');
    });

    it('应该正确处理没有质量信息的 Job（所有字段应为 null）', async () => {
      const taskId = 'test-task-id';
      const mockGraph = {
        taskId,
        projectId: 'test-project-id',
        taskType: 'NOVEL_ANALYSIS',
        status: 'SUCCEEDED',
        jobs: [
          {
            jobId: 'job-3',
            jobType: 'NOVEL_ANALYSIS',
            status: 'PENDING',
            attempts: 0,
            retryCount: 0,
            maxRetry: null,
            createdAt: '2025-12-11T00:00:00Z',
            startedAt: null,
            finishedAt: null,
          },
        ],
      };

      const mockRawJob = {
        id: 'job-3',
        type: 'NOVEL_ANALYSIS',
        payload: {
          engineKey: 'default_novel_analysis',
        },
        // 没有 result 字段
      };

      mockTaskGraphService.findTaskGraph.mockResolvedValue(mockGraph);
      mockPrismaService.shotJob.findMany.mockResolvedValue([mockRawJob]);
      mockJobService.extractEngineKeyFromJob.mockReturnValue('default_novel_analysis');
      mockJobService.extractEngineVersionFromJob.mockReturnValue(null);
      mockEngineRegistry.getAdapter.mockReturnValue({ name: 'default_novel_analysis' });
      mockQualityScoreService.buildQualityScoreFromJob.mockReturnValue(null); // 没有质量信息
      mockQualityFeedbackService.evaluateQualityScores.mockReturnValue({
        avgScore: null,
        avgConfidence: null,
        total: 0,
      });

      const result = await controller.getTaskGraph(taskId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const job = result.data?.jobs[0];
      expect(job).toBeDefined();
      // 验证引擎信息存在
      expect(job.engineKey).toBe('default_novel_analysis');
      // 验证质量指标为 null
      expect(job.qualityScore).toBe(null);
      // 验证性能指标为 null
      expect(job.metrics).toBe(null);
    });
  });
});
