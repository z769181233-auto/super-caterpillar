import { Test, TestingModule } from '@nestjs/testing';
import { FilmIRService } from './film-ir.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

/**
 * Film IR Service Smoke Tests (P2-0)
 *
 * 覆盖：
 * 1. create — 正常创建 DRAFT 记录
 * 2. findByScene — 查找成功 / scene 不存在
 * 3. update — DRAFT 更新成功 / LOCKED 拒绝
 * 4. approve — DRAFT→APPROVED 转换 / 重复 approve
 * 5. lock — APPROVED→LOCKED 转换 / DRAFT 直接 lock 拒绝
 * 6. replan — 版本递增 / sceneId 验证
 * 7. AuditLog — 写入验证
 */
describe('FilmIRService Smoke Tests', () => {
  let service: FilmIRService;

  /** Mock FilmIR 数据 */
  const mockDraftFilmIR = {
    id: 'test-filmIR-001',
    sceneId: 'scene-001',
    projectId: 'project-001',
    plannerVersion: 'film-planner-v1',
    status: 'DRAFT',
    sourceText: '场景原文',
    sourceContextSummary: null,
    dramaticFunction: null,
    dramaticGoal: null,
    emotionalTarget: null,
    tensionCurve: null,
    povCharacter: null,
    audienceInformationMode: null,
    relationshipBefore: null,
    relationshipAfter: null,
    visualStrategy: null,
    blockingStrategy: null,
    shotPattern: null,
    avgShotLengthSec: null,
    cameraDistanceStrategy: null,
    cameraAngleStrategy: null,
    cameraMotionStyle: null,
    compositionStyle: null,
    spatialStrategy: null,
    lightingStyle: null,
    colorStrategy: null,
    soundStrategy: null,
    silenceStrategy: null,
    editingRhythmStrategy: null,
    continuityConstraints: null,
    characterStateConstraints: null,
    costumeStateConstraints: null,
    propStateConstraints: null,
    locationStateConstraints: null,
    whyThisChoice: null,
    alternativeRejectedReason: null,
    qualityScore: null,
    confidence: null,
    evidenceRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockApprovedFilmIR = { ...mockDraftFilmIR, status: 'APPROVED' };
  const mockLockedFilmIR = { ...mockDraftFilmIR, status: 'LOCKED' };

  /** Mock PrismaService（含 filmIR delegate）*/
  const mockPrismaService = {
    scene: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    filmIR: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAuditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilmIRService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<FilmIRService>(FilmIRService);
    jest.resetAllMocks();
  });

  // ==============================
  // 1. CREATE 测试
  // ==============================
  describe('create()', () => {
    it('应成功创建 DRAFT 状态的 FilmIR 记录', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue({
        id: 'scene-001',
        projectId: 'project-001',
        enrichedText: '丰富文本',
      });
      mockPrismaService.filmIR.findUnique.mockResolvedValue(null); // 无 LOCKED 冲突
      mockPrismaService.filmIR.create.mockResolvedValue(mockDraftFilmIR);
      mockPrismaService.scene.update.mockResolvedValue({});

      const result = await service.create({ sceneId: 'scene-001' });

      expect(result.status).toBe('DRAFT');
      expect(result.sceneId).toBe('scene-001');
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FILM_IR_CREATED' }),
      );
    });

    it('Scene 不存在时应抛出 NotFoundException', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(null);
      await expect(service.create({ sceneId: 'nonexistent' })).rejects.toThrow(NotFoundException);
    });

    it('同版本 LOCKED 记录存在时应抛出 ConflictException', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue({
        id: 'scene-001',
        projectId: 'project-001',
        enrichedText: null,
      });
      mockPrismaService.filmIR.findUnique.mockResolvedValue(mockLockedFilmIR);

      await expect(service.create({ sceneId: 'scene-001' })).rejects.toThrow(ConflictException);
    });
  });

  // ==============================
  // 2. FIND BY SCENE 测试
  // ==============================
  describe('findByScene()', () => {
    it('应返回 sceneId 对应的最新 FilmIR', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue({ id: 'scene-001' });
      mockPrismaService.filmIR.findMany.mockResolvedValue([mockDraftFilmIR]);

      const result = await service.findByScene('scene-001');
      expect(result?.sceneId).toBe('scene-001');
    });

    it('Scene 不存在时应抛出 NotFoundException', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(null);
      await expect(service.findByScene('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('Scene 无 FilmIR 时应返回 null（不报错）', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue({ id: 'scene-001' });
      mockPrismaService.filmIR.findMany.mockResolvedValue([]);

      const result = await service.findByScene('scene-001');
      expect(result).toBeNull();
    });
  });

  // ==============================
  // 3. UPDATE 测试
  // ==============================
  describe('update()', () => {
    it('DRAFT 状态下应成功更新字段', async () => {
      const updated = { ...mockDraftFilmIR, dramaticFunction: 'CONFLICT' };
      mockPrismaService.filmIR.findUnique
        .mockResolvedValueOnce(mockDraftFilmIR)
        .mockResolvedValueOnce(null);
      mockPrismaService.filmIR.update.mockResolvedValue(updated);

      const result = await service.update('test-filmIR-001', { dramaticFunction: 'CONFLICT' });
      expect(result.dramaticFunction).toBe('CONFLICT');
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FILM_IR_UPDATED' }),
      );
    });

    it('LOCKED 状态下应拒绝所有更新', async () => {
      mockPrismaService.filmIR.findUnique.mockResolvedValue(mockLockedFilmIR);
      await expect(
        service.update('test-filmIR-001', { dramaticFunction: 'RESOLUTION' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('不允许从 APPROVED 回退到 DRAFT', async () => {
      mockPrismaService.filmIR.findUnique.mockResolvedValue(mockApprovedFilmIR);
      await expect(
        service.update('test-filmIR-001', { status: 'DRAFT' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==============================
  // 4. APPROVE 测试
  // ==============================
  describe('approve()', () => {
    it('DRAFT → APPROVED 转换应成功', async () => {
      const approved = { ...mockDraftFilmIR, status: 'APPROVED' };
      mockPrismaService.filmIR.findUnique.mockResolvedValue(mockDraftFilmIR);
      mockPrismaService.filmIR.update.mockResolvedValue(approved);

      const result = await service.approve('test-filmIR-001');
      expect(result.status).toBe('APPROVED');
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FILM_IR_APPROVED' }),
      );
    });

    it('已是 APPROVED 时应抛出 ConflictException', async () => {
      mockPrismaService.filmIR.findUnique.mockResolvedValue(mockApprovedFilmIR);
      await expect(service.approve('test-filmIR-001')).rejects.toThrow(ConflictException);
    });

    it('LOCKED 状态下 approve 应抛出 BadRequestException', async () => {
      mockPrismaService.filmIR.findUnique.mockResolvedValue(mockLockedFilmIR);
      await expect(service.approve('test-filmIR-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ==============================
  // 5. LOCK 测试
  // ==============================
  describe('lock()', () => {
    it('APPROVED → LOCKED 转换应成功', async () => {
      const locked = { ...mockApprovedFilmIR, status: 'LOCKED' };
      mockPrismaService.filmIR.findUnique.mockResolvedValue(mockApprovedFilmIR);
      mockPrismaService.filmIR.update.mockResolvedValue(locked);

      const result = await service.lock('test-filmIR-001');
      expect(result.status).toBe('LOCKED');
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FILM_IR_LOCKED' }),
      );
    });

    it('DRAFT 直接 lock 应拒绝（必须先 approve）', async () => {
      mockPrismaService.filmIR.findUnique.mockResolvedValue(mockDraftFilmIR);
      await expect(service.lock('test-filmIR-001')).rejects.toThrow(BadRequestException);
    });

    it('已是 LOCKED 时应抛出 ConflictException', async () => {
      mockPrismaService.filmIR.findUnique.mockResolvedValue(mockLockedFilmIR);
      await expect(service.lock('test-filmIR-001')).rejects.toThrow(ConflictException);
    });
  });

  // ==============================
  // 6. REPLAN 测试
  // ==============================
  describe('replan()', () => {
    it('应创建新版本并递增 plannerVersion', async () => {
      const v2FilmIR = { ...mockDraftFilmIR, id: 'test-filmIR-002', plannerVersion: 'film-planner-v2' };

      mockPrismaService.filmIR.findUnique
        .mockResolvedValueOnce(mockDraftFilmIR)
        .mockResolvedValueOnce(null);
      mockPrismaService.scene.findUnique.mockResolvedValue({
        id: 'scene-001',
        projectId: 'project-001',
        enrichedText: null,
      });
      mockPrismaService.filmIR.create.mockResolvedValue(v2FilmIR);
      mockPrismaService.scene.update.mockResolvedValue({});

      const result = await service.replan('test-filmIR-001');
      expect(result.plannerVersion).toBe('film-planner-v2');
    });

    it('film-planner-v2 应递增为 film-planner-v3', async () => {
      const v2 = { ...mockDraftFilmIR, plannerVersion: 'film-planner-v2' };
      const v3 = { ...mockDraftFilmIR, plannerVersion: 'film-planner-v3' };

      mockPrismaService.filmIR.findUnique
        .mockResolvedValueOnce(v2)
        .mockResolvedValueOnce(null);
      mockPrismaService.scene.findUnique.mockResolvedValue({
        id: 'scene-001',
        projectId: 'project-001',
        enrichedText: null,
      });
      mockPrismaService.filmIR.findUnique.mockResolvedValue(null);
      mockPrismaService.filmIR.create.mockResolvedValue(v3);
      mockPrismaService.scene.update.mockResolvedValue({});

      const result = await service.replan('test-filmIR-001');
      expect(result.plannerVersion).toBe('film-planner-v3');
    });

    it('FilmIR 无 sceneId 时应拒绝 replan', async () => {
      mockPrismaService.filmIR.findUnique.mockResolvedValue({
        ...mockDraftFilmIR,
        sceneId: null,
      });
      await expect(service.replan('test-filmIR-001')).rejects.toThrow(BadRequestException);
    });
  });

  // ==============================
  // 7. AUDIT LOG 验证
  // ==============================
  describe('AuditLog 写入', () => {
    it('create 应记录 FILM_IR_CREATED', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue({ id: 'scene-001', projectId: 'p-001', enrichedText: null });
      mockPrismaService.filmIR.findUnique.mockResolvedValue(null);
      mockPrismaService.filmIR.create.mockResolvedValue(mockDraftFilmIR);
      mockPrismaService.scene.update.mockResolvedValue({});

      await service.create({ sceneId: 'scene-001' }, 'user-001');
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FILM_IR_CREATED',
          userId: 'user-001',
          resourceType: 'film_ir',
        }),
      );
    });

    it('lock 应记录 FILM_IR_LOCKED', async () => {
      const locked = { ...mockApprovedFilmIR, status: 'LOCKED' };
      mockPrismaService.filmIR.findUnique.mockResolvedValue(mockApprovedFilmIR);
      mockPrismaService.filmIR.update.mockResolvedValue(locked);

      await service.lock('test-filmIR-001', 'user-001');
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'FILM_IR_LOCKED',
          userId: 'user-001',
        }),
      );
    });
  });
});
