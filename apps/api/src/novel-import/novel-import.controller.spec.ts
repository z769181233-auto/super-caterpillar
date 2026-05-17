import { ConflictException } from '@nestjs/common';
import { NovelImportController } from './novel-import.controller';

describe('NovelImportController', () => {
  const mockNovelImportService = {};
  const mockFileParserService = {
    parseChaptersFromText: jest.fn(),
  };
  const mockAnalysisProcessor = {};
  const mockProjectService = {
    checkOwnership: jest.fn(),
  };
  const mockPrisma = {
    novel: {
      findUnique: jest.fn(),
    },
    shotJob: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    novelAnalysisJob: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const mockTaskService = {
    create: jest.fn(),
  };
  const mockEngineTaskService = {};
  const mockJobService = {
    createNovelAnalysisJob: jest.fn(),
  };
  const mockStructureGenerateService = {};
  const mockSceneGraphService = {};
  const mockAuditLogService = {};
  const mockFeatureFlagService = {
    isEnabled: jest.fn().mockReturnValue(false),
  };
  const mockTextSafetyService = {
    sanitize: jest.fn(),
  };

  let controller: NovelImportController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new NovelImportController(
      mockNovelImportService as any,
      mockFileParserService as any,
      mockAnalysisProcessor as any,
      mockProjectService as any,
      mockPrisma as any,
      mockTaskService as any,
      mockEngineTaskService as any,
      mockJobService as any,
      mockStructureGenerateService as any,
      mockSceneGraphService as any,
      mockAuditLogService as any,
      mockFeatureFlagService as any,
      mockTextSafetyService as any
    );
    mockProjectService.checkOwnership.mockResolvedValue(undefined);
    mockPrisma.novel.findUnique.mockResolvedValue(null);
    mockPrisma.shotJob.findMany.mockResolvedValue([]);
    mockPrisma.shotJob.findUnique.mockResolvedValue(null);
    mockPrisma.novelAnalysisJob.findFirst.mockResolvedValue(null);
    mockPrisma.novelAnalysisJob.findMany.mockResolvedValue([]);
    mockTaskService.create.mockResolvedValue({ id: 'task-1' });
    mockJobService.createNovelAnalysisJob.mockResolvedValue({ id: 'job-1' });
    mockPrisma.novelAnalysisJob.create.mockResolvedValue({ id: 'analysis-1' });
    mockPrisma.novelAnalysisJob.update.mockResolvedValue({ id: 'analysis-1' });
  });

  it('重复导入时应保留 ConflictException 语义', async () => {
    mockPrisma.novel.findUnique.mockResolvedValue({
      id: 'novel-1',
      title: 'Existing Novel',
    });

    await expect(
      controller.importNovel(
        'project-1',
        { rawText: '第一章\n测试正文', title: 'Repeat Import' } as any,
        { userId: 'user-1' },
        'org-1',
        { ip: '127.0.0.1', headers: {} } as any
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('已有进行中的分析任务时应拒绝重复分析', async () => {
    mockPrisma.novel.findUnique.mockResolvedValue({
      id: 'novel-1',
      projectId: 'project-1',
    });
    mockPrisma.novelAnalysisJob.findFirst.mockResolvedValue({
      id: 'analysis-active',
      status: 'RUNNING',
      jobType: 'ANALYZE_ALL',
      progress: { jobId: 'job-active', taskId: 'task-active' },
    });
    mockPrisma.shotJob.findUnique.mockResolvedValue({
      status: 'RUNNING',
    });

    await expect(
      controller.analyzeNovel(
        'project-1',
        {},
        { userId: 'user-1' },
        'org-1',
        { ip: '127.0.0.1', headers: {} } as any
      )
    ).rejects.toBeInstanceOf(ConflictException);

    expect(mockPrisma.novelAnalysisJob.create).not.toHaveBeenCalled();
    expect(mockJobService.createNovelAnalysisJob).not.toHaveBeenCalled();
  });

  it('backing shot job 已终态时应允许重新分析', async () => {
    mockPrisma.novel.findUnique.mockResolvedValue({
      id: 'novel-1',
      projectId: 'project-1',
    });
    mockPrisma.novelAnalysisJob.findFirst.mockResolvedValue({
      id: 'analysis-resolved',
      status: 'PENDING',
      jobType: 'ANALYZE_ALL',
      progress: { jobId: 'job-resolved', taskId: 'task-resolved' },
    });
    mockPrisma.shotJob.findUnique.mockResolvedValue({
      status: 'SUCCEEDED',
    });

    await controller.analyzeNovel(
      'project-1',
      {},
      { userId: 'user-1' },
      'org-1',
      { ip: '127.0.0.1', headers: {} } as any
    );

    expect(mockJobService.createNovelAnalysisJob).toHaveBeenCalled();
    expect(mockPrisma.novelAnalysisJob.create).toHaveBeenCalled();
  });

  it('应将 traceId 透传给 novel analysis job 创建', async () => {
    mockPrisma.novel.findUnique.mockResolvedValue({
      id: 'novel-1',
      projectId: 'project-1',
    });

    await controller.analyzeNovel(
      'project-1',
      { traceId: 'trace-smoke-1' },
      { userId: 'user-1' },
      'org-1',
      { ip: '127.0.0.1', headers: {} } as any
    );

    expect(mockJobService.createNovelAnalysisJob).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trace-smoke-1',
        payload: expect.objectContaining({
          projectId: 'project-1',
          traceId: 'trace-smoke-1',
        }),
      }),
      'user-1',
      'org-1',
      'task-1',
      undefined,
      '127.0.0.1',
      undefined
    );
  });

  it('body 未提供 traceId 时应回退到 x-trace-id header', async () => {
    mockPrisma.novel.findUnique.mockResolvedValue({
      id: 'novel-1',
      projectId: 'project-1',
    });

    await controller.analyzeNovel(
      'project-1',
      {},
      { userId: 'user-1' },
      'org-1',
      {
        ip: '127.0.0.1',
        headers: { 'x-trace-id': 'trace-header-1' },
      } as any
    );

    expect(mockJobService.createNovelAnalysisJob).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trace-header-1',
        payload: expect.objectContaining({
          traceId: 'trace-header-1',
        }),
      }),
      'user-1',
      'org-1',
      'task-1',
      undefined,
      '127.0.0.1',
      undefined
    );
  });

  it('getAnalysisJobs 应以 backing shot job 状态覆盖陈旧的 novelAnalysisJob 状态', async () => {
    mockPrisma.novelAnalysisJob.findMany.mockResolvedValue([
      {
        id: 'analysis-1',
        projectId: 'project-1',
        novelSourceId: 'novel-1',
        jobType: 'ANALYZE_ALL',
        status: 'PENDING',
        progress: { jobId: 'job-1', taskId: 'task-1', message: 'Job created' },
        createdAt: new Date('2026-05-07T03:57:11.964Z'),
        updatedAt: new Date('2026-05-07T03:57:12.613Z'),
      },
    ]);
    mockPrisma.shotJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        type: 'NOVEL_ANALYSIS',
        status: 'SUCCEEDED',
        createdAt: new Date('2026-05-07T03:57:12.600Z'),
        updatedAt: new Date('2026-05-07T04:09:33.110Z'),
      },
    ]);

    const result = await controller.getAnalysisJobs('project-1', { userId: 'user-1' }, 'org-1');

    expect(result.success).toBe(true);
    expect(result.data.jobs).toHaveLength(1);
    expect(result.data.jobs[0]).toMatchObject({
      id: 'analysis-1',
      status: 'SUCCEEDED',
      type: 'NOVEL_ANALYSIS',
    });
    expect(mockPrisma.shotJob.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['job-1'] } },
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
});
