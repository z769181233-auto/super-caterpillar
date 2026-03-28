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
    novelAnalysisJob: {
      findFirst: jest.fn(),
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
    mockPrisma.novelAnalysisJob.findFirst.mockResolvedValue(null);
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
});
