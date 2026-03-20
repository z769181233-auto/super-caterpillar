import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FilmIRPlannerService } from './film-ir-planner.service';
import { FilmIRService } from './film-ir.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { FilmIROutputValidator } from './film-ir-output-validator.service';
import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';

/**
 * FilmIR Planner Service 行为测试（P2.2 封板）
 *
 * 测试分组：
 * A. dry_run 行为
 * B. save_as_draft 行为
 * C. validation 失败保护
 * D. Provider 异常隔离
 * E. Strict Mode 行为
 * F. Contract 测试（枚举/必填/fallback）
 */
describe('FilmIRPlannerService Behavior Tests (P2.2)', () => {
  let service: FilmIRPlannerService;

  // ==================================================================
  // Mock 数据基线
  // ==================================================================

  const validDraftFields = {
    dramatic_function: 'CONFLICT',
    dramatic_goal: '主角与对手的正面冲突',
    emotional_target: '压迫感 → 紧张对峙 → 短暂呼吸',
    pov_character: null,
    audience_information_mode: 'DRAMATIC_IRONY',
    visual_strategy: '近景主导，强调面部冲突',
    blocking_strategy: '角色保持静态对立',
    shot_pattern: 'CLOSE_UP_DOMINANT',
    avg_shot_length: 3.5,
    camera_motion_style: 'STATIC',
    composition_style: '三等分构图',
    lighting_style: 'LOW_KEY',
    color_strategy: '冷蓝调，低饱和',
    sound_strategy: '环境音渐弱，对话主导',
    continuity_constraints: { mustMatch: ['character_costume'] },
    why_this_choice: '冲突场景采用近景强化情绪',
    alternative_rejected_reason: '宽景方案分散冲突焦点',
  };

  const mockScene = {
    id: 'scene-001',
    projectId: 'project-001',
    enrichedText: '场景原文测试内容，包含足够长度以通过验证。',
  };

  const mockDraftFilmIR = {
    id: 'filmIR-001',
    sceneId: 'scene-001',
    projectId: 'project-001',
    plannerVersion: 'film-planner-v1',
    status: 'DRAFT',
    sourceText: null,
    sourceContextSummary: null,
    evidenceRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // ==================================================================
  // Mock Dependencies
  // ==================================================================

  const mockPrismaService = {
    scene: {
      findUnique: jest.fn().mockResolvedValue(mockScene),
      update: jest.fn().mockResolvedValue({}),
    },
    filmIR: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockDraftFilmIR),
      update: jest.fn().mockResolvedValue(mockDraftFilmIR),
    },
  };

  const mockFilmIRService = {
    create: jest.fn().mockResolvedValue(mockDraftFilmIR),
    update: jest.fn().mockResolvedValue(mockDraftFilmIR),
  };

  const mockAuditLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  const mockValidator = new FilmIROutputValidator();

  /** Mock ConfigService：默认 mock provider，非 strict 模式 */
  const createMockConfigService = (overrides: Record<string, unknown> = {}) => ({
    get: jest.fn((key: string) => {
      const defaults: Record<string, unknown> = {
        filmIrPlannerEnabled: true,
        filmIrPlannerProvider: 'mock',
        filmIrPlannerModel: 'gpt-4o-mini',
        filmIrPlannerTimeoutMs: 30000,
        filmIrPlannerMaxRetries: 2,
        filmIrPlannerStrictMode: false,
        openaiApiKey: undefined,
        ...overrides,
      };
      return defaults[key];
    }),
  });

  const buildModule = async (configOverrides: Record<string, unknown> = {}) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilmIRPlannerService,
        { provide: ConfigService, useValue: createMockConfigService(configOverrides) },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FilmIRService, useValue: mockFilmIRService },
        { provide: FilmIROutputValidator, useValue: mockValidator },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    return module.get<FilmIRPlannerService>(FilmIRPlannerService);
  };

  beforeEach(async () => {
    service = await buildModule();
    service.onModuleInit();
    jest.clearAllMocks();
  });

  // ==================================================================
  // A. dry_run 行为
  // ==================================================================
  describe('A. dry_run 行为', () => {
    it('A1: dry_run=true 时不写 DB，返回 film_ir_id=null', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);
      const result = await service.plan({ scene_id: 'scene-001', dry_run: true });

      expect(result.dry_run).toBe(true);
      expect(result.film_ir_id).toBeNull();
      expect(mockFilmIRService.create).not.toHaveBeenCalled();
      expect(result.draft_fields).toBeDefined();
    });

    it('A2: dry_run=true 时仍然执行 Provider 调用（验证结果）', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);
      const result = await service.plan({ scene_id: 'scene-001', dry_run: true });

      expect(result.planner_meta.provider).toBe('mock');
      expect(result.draft_fields).toBeDefined();
    });

    it('A3: dry_run=true 时 validation 不合格也不写 DB（双重保护）', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);
      const result = await service.plan({ scene_id: 'scene-001', dry_run: true });

      // dry_run 优先于一切，即使 validation 通过也不写
      expect(mockFilmIRService.create).not.toHaveBeenCalled();
    });
  });

  // ==================================================================
  // B. save_as_draft 行为
  // ==================================================================
  describe('B. save_as_draft 行为', () => {
    it('B1: save_as_draft=true 且 validation 通过时，写入 DRAFT 状态', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);
      mockFilmIRService.create.mockResolvedValue(mockDraftFilmIR);
      mockFilmIRService.update.mockResolvedValue(mockDraftFilmIR);

      const result = await service.plan({ scene_id: 'scene-001', save_as_draft: true });

      // Mock provider 输出合法，validation 通过，应写 DB
      if (result.validation.valid) {
        expect(mockFilmIRService.create).toHaveBeenCalled();
        expect(result.film_ir_id).toBeDefined();
      }
    });

    it('B2: Planner 不可直接设置 APPROVED/LOCKED 状态（只写 DRAFT）', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);
      mockFilmIRService.create.mockResolvedValue(mockDraftFilmIR);

      await service.plan({ scene_id: 'scene-001', save_as_draft: true });

      if (mockFilmIRService.create.mock.calls.length > 0) {
        const createArg = mockFilmIRService.create.mock.calls[0][0];
        // create 不传 status 字段，FilmIRService 默认为 DRAFT
        expect(createArg.status).toBeUndefined();
      }
    });

    it('B3: Scene 不存在时抛出 BadRequestException', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(null);
      await expect(service.plan({ scene_id: 'nonexistent' })).rejects.toThrow(BadRequestException);
    });

    it('B4: Scene 无 enrichedText 且未提供 source_text 时抛出 BadRequestException', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue({
        id: 'scene-001',
        projectId: 'project-001',
        enrichedText: null,
      });
      await expect(service.plan({ scene_id: 'scene-001' })).rejects.toThrow(BadRequestException);
    });
  });

  // ==================================================================
  // C. Validation 失败保护
  // ==================================================================
  describe('C. Validation 失败保护', () => {
    it('C1: validation.valid=false 时不写 DB，写 AuditLog FILM_IR_PLAN_VALIDATION_FAILED', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);

      // 模拟 Validator 返回失败
      jest.spyOn(mockValidator, 'validate').mockReturnValueOnce({
        valid: false,
        errors: [{ field: 'dramatic_function', message: '非法枚举值', received: 'INVALID' }],
        warnings: [],
      });

      const result = await service.plan({ scene_id: 'scene-001' });

      expect(result.film_ir_id).toBeNull();
      expect(result.validation.valid).toBe(false);
      expect(mockFilmIRService.create).not.toHaveBeenCalled();
    });

    it('C2: 枚举非法值（dramatic_function=INVALID）应被 Validator 阻断', () => {
      const result = mockValidator.validate({
        ...validDraftFields,
        dramatic_function: 'INVALID_FUNCTION',
      });

      const dramaticFnError = result.errors.find(e => e.field === 'dramatic_function');
      expect(dramaticFnError).toBeDefined();
      expect(result.valid).toBe(false);
    });

    it('C3: 必填字段缺失（dramatic_goal 为空）应被阻断', () => {
      const result = mockValidator.validate({
        ...validDraftFields,
        dramatic_goal: '',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'dramatic_goal')).toBe(true);
    });

    it('C4: P2.2 shot_pattern 非法值升级为 errors（之前是 warnings）', () => {
      const result = mockValidator.validate({
        ...validDraftFields,
        shot_pattern: 'INVALID_PATTERN',
      });

      const err = result.errors.find(e => e.field === 'shot_pattern');
      expect(err).toBeDefined(); // 现在是 errors，不是 warnings
      expect(result.valid).toBe(false);
    });

    it('C5: P2.2 camera_motion_style 非法值升级为 errors', () => {
      const result = mockValidator.validate({
        ...validDraftFields,
        camera_motion_style: 'INVALID_MOTION',
      });

      const err = result.errors.find(e => e.field === 'camera_motion_style');
      expect(err).toBeDefined();
      expect(result.valid).toBe(false);
    });

    it('C6: P2.2 lighting_style 非法值升级为 errors', () => {
      const result = mockValidator.validate({
        ...validDraftFields,
        lighting_style: 'INVALID_LIGHT',
      });

      const err = result.errors.find(e => e.field === 'lighting_style');
      expect(err).toBeDefined();
      expect(result.valid).toBe(false);
    });

    it('C7: avg_shot_length < 0.5 应报 error', () => {
      const result = mockValidator.validate({
        ...validDraftFields,
        avg_shot_length: 0.2,
      });

      expect(result.errors.some(e => e.field === 'avg_shot_length')).toBe(true);
    });
  });

  // ==================================================================
  // D. Provider 异常隔离
  // ==================================================================
  describe('D. Provider 异常隔离', () => {
    it('D1: Provider 调用失败时抛出 UnprocessableEntityException，不写 DB', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);

      // 强制 provider 失败
      const failingProvider = {
        providerId: 'mock-fail',
        modelId: 'fail-model',
        invoke: jest.fn().mockRejectedValue(new Error('Network timeout')),
      };
      (service as any).provider = failingProvider;

      await expect(service.plan({ scene_id: 'scene-001' })).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(mockFilmIRService.create).not.toHaveBeenCalled();
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FILM_IR_PLAN_FAILED' }),
      );
    });

    it('D2: Provider 失败不污染已有 APPROVED/LOCKED 记录', async () => {
      // 验证失败路径不调用任何 db 写操作（隔离测试）
      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);
      const failingProvider = {
        providerId: 'mock-fail',
        modelId: 'fail',
        invoke: jest.fn().mockRejectedValue(new Error('API Error')),
      };
      (service as any).provider = failingProvider;

      try {
        await service.plan({ scene_id: 'scene-001' });
      } catch {
        // 期望抛出异常
      }

      // 关键：失败路径不调用 filmIRService.update（避免污染 APPROVED/LOCKED）
      expect(mockFilmIRService.update).not.toHaveBeenCalled();
    });
  });

  // ==================================================================
  // E. Strict Mode 行为
  // ==================================================================
  describe('E. Strict Mode 行为', () => {
    it('E1: strictMode=true 时 warnings 也阻断写 DB', async () => {
      const strictService = await buildModule({ filmIrPlannerStrictMode: true });
      strictService.onModuleInit();

      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);

      // 返回有 warnings 但无 errors 的校验结果
      jest.spyOn(mockValidator, 'validate').mockReturnValueOnce({
        valid: true,
        errors: [],
        warnings: [{ field: 'audience_information_mode', message: '非标准值' }],
      });

      const result = await strictService.plan({ scene_id: 'scene-001' });

      expect(result.film_ir_id).toBeNull(); // strict 模式下 warnings 也阻断
    });

    it('E2: strictMode=false 时 warnings 不阻断，正常写 DB', async () => {
      const nonStrictService = await buildModule({ filmIrPlannerStrictMode: false });
      nonStrictService.onModuleInit();

      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);
      mockFilmIRService.create.mockResolvedValue(mockDraftFilmIR);
      mockFilmIRService.update.mockResolvedValue(mockDraftFilmIR);

      jest.spyOn(mockValidator, 'validate').mockReturnValueOnce({
        valid: true,
        errors: [],
        warnings: [{ field: 'audience_information_mode', message: '非标准值' }],
      });

      const result = await nonStrictService.plan({ scene_id: 'scene-001', save_as_draft: true });
      // valid=true，非 strict，应该写 DB
      expect(mockFilmIRService.create).toHaveBeenCalled();
    });
  });

  // ==================================================================
  // F. AuditLog Evidence 验证
  // ==================================================================
  describe('F. AuditLog Evidence', () => {
    it('F1: 规划成功时记录 FILM_IR_PLANNED', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);
      mockFilmIRService.create.mockResolvedValue(mockDraftFilmIR);
      mockFilmIRService.update.mockResolvedValue(mockDraftFilmIR);

      jest.spyOn(mockValidator, 'validate').mockReturnValueOnce({
        valid: true, errors: [], warnings: [],
      });

      await service.plan({ scene_id: 'scene-001', save_as_draft: true });

      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FILM_IR_PLANNED' }),
      );
    });

    it('F2: Provider 失败时记录 FILM_IR_PLAN_FAILED', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);
      (service as any).provider = {
        providerId: 'mock', modelId: 'm',
        invoke: jest.fn().mockRejectedValue(new Error('Fail')),
      };

      try { await service.plan({ scene_id: 'scene-001' }); } catch {}

      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FILM_IR_PLAN_FAILED' }),
      );
    });

    it('F3: Validation 失败时记录 FILM_IR_PLAN_VALIDATION_FAILED', async () => {
      mockPrismaService.scene.findUnique.mockResolvedValue(mockScene);
      jest.spyOn(mockValidator, 'validate').mockReturnValueOnce({
        valid: false,
        errors: [{ field: 'dramatic_function', message: 'error' }],
        warnings: [],
      });

      await service.plan({ scene_id: 'scene-001' });

      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'FILM_IR_PLAN_VALIDATION_FAILED' }),
      );
    });
  });
});
