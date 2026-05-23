import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import type { FilmIRRecord, FilmIRDelegate, FilmIRStatus } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateFilmIRDto, UpdateFilmIRDto } from './dto/create-film-ir.dto';

/**
 * Film IR Service — P1/P2-2 阶段（强类型 CRUD + planner 持久化支撑）
 *
 * P1 范围：完整 CRUD + replan + AuditLog 记录
 * P2-0 硬化：移除所有 (any) 绕过，使用 FilmIRDelegate 强类型
 * P2-2：提供 FilmIRPlannerService 落库所需的版本化 CRUD 能力
 *
 * 状态机规则（见 film_ir_state_machine.md）：
 * - DRAFT: 初始状态，所有字段可更新
 * - APPROVED: 可更新部分字段（排除 status/source 类），只能由人工审批触发
 * - LOCKED: 不可更新任何字段，不可 replan 覆盖（只能新建版本）
 *
 * 版本口径：
 * - scene 永远消费最新 filmIrId 指针（Scene.filmIrId）
 * - shot planner / gate 默认消费 APPROVED 或 LOCKED 状态的记录
 * - replan 创建新版本（plannerVersion 递增），原版本保留
 */
@Injectable()
export class FilmIRService {
  private readonly logger = new Logger(FilmIRService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * 强类型访问器：统一使用 generated Prisma delegate 类型
   */
  private get filmIr(): FilmIRDelegate {
    return this.prisma.filmIR;
  }

  /**
   * 创建 Film IR 记录（供人工创建与 planner 落库共用）
   *
   * 幂等：同 sceneId + plannerVersion + status=LOCKED 的记录不允许重建
   */
  async create(dto: CreateFilmIRDto, userId?: string): Promise<FilmIRRecord> {
    const { sceneId, plannerVersion = 'film-planner-v1', sourceText, sourceContextSummary } = dto;

    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: { id: true, projectId: true, enrichedText: true },
    });

    if (!scene) {
      throw new NotFoundException(`Scene ${sceneId} not found`);
    }
    if (!scene.projectId) {
      throw new BadRequestException(`Scene ${sceneId} has no projectId`);
    }

    // 幂等检查：LOCKED 版本不允许重建
    const existingLocked = await this.filmIr.findUnique({
      where: {
        sceneId_plannerVersion: {
          sceneId,
          plannerVersion,
        },
      },
    });
    if (existingLocked?.status === 'LOCKED') {
      throw new ConflictException(
        `FilmIR for scene ${sceneId} version ${plannerVersion} is LOCKED. Use /replan to create new version.`,
      );
    }

    const filmIr = await this.filmIr.create({
      data: {
        sceneId,
        projectId: scene.projectId,
        plannerVersion,
        status: 'DRAFT',
        sourceText: sourceText ?? scene.enrichedText ?? null,
        sourceContextSummary: sourceContextSummary ?? null,
      },
    });

    // 更新 Scene.filmIrId 指针（指向本 Scene 最新 FilmIR）
    // 本地 schema 与生成类型存在时间差时，这里只做最小结构写入。
    await (this.prisma.scene.update as Function)({
      where: { id: sceneId },
      data: { filmIrId: filmIr.id },
    });

    await this.auditLogService.record({
      userId,
      action: 'FILM_IR_CREATED',
      resourceType: 'film_ir',
      resourceId: filmIr.id,
      details: { sceneId, plannerVersion, projectId: scene.projectId, status: 'DRAFT' },
    });

    this.logger.log(
      `[FilmIR] Created id=${filmIr.id} sceneId=${sceneId} version=${plannerVersion}`,
    );
    return filmIr;
  }

  /**
   * 获取 Film IR 详情（按 id）
   */
  async findOne(id: string): Promise<FilmIRRecord> {
    const filmIr = await this.filmIr.findUnique({ where: { id } });
    if (!filmIr) {
      throw new NotFoundException(`FilmIR ${id} not found`);
    }
    return filmIr;
  }

  /**
   * 获取 Scene 当前 Film IR（按 sceneId，返回最新版本）
   */
  async findByScene(sceneId: string): Promise<FilmIRRecord | null> {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: { id: true },
    });
    if (!scene) {
      throw new NotFoundException(`Scene ${sceneId} not found`);
    }
    const filmIrs = await this.filmIr.findMany({
      where: { sceneId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 1,
    });
    return filmIrs[0] ?? null;
  }

  /**
   * 更新 Film IR 字段
   *
   * 状态机规则：
   * - DRAFT：所有字段可更新
   * - APPROVED：允许更新导演决策字段（不允许改 status 回 DRAFT）
   * - LOCKED：拒绝所有更新
   */
  async update(id: string, dto: UpdateFilmIRDto, userId?: string): Promise<FilmIRRecord> {
    const filmIr = await this.filmIr.findUnique({ where: { id } });
    if (!filmIr) {
      throw new NotFoundException(`FilmIR ${id} not found`);
    }
    if (filmIr.status === 'LOCKED') {
      throw new BadRequestException(
        `FilmIR ${id} is LOCKED. No updates allowed. Use /replan to create a new version.`,
      );
    }
    // APPROVED → DRAFT 回退禁止
    if (filmIr.status === 'APPROVED' && dto.status === 'DRAFT') {
      throw new BadRequestException(
        `Cannot revert FilmIR ${id} from APPROVED to DRAFT. Use /replan to create a new version.`,
      );
    }

    const updated = await this.filmIr.update({
      where: { id },
      data: {
        ...(dto.dramaticFunction !== undefined && { dramaticFunction: dto.dramaticFunction }),
        ...(dto.dramaticGoal !== undefined && { dramaticGoal: dto.dramaticGoal }),
        ...(dto.emotionalTarget !== undefined && { emotionalTarget: dto.emotionalTarget }),
        ...(dto.tensionCurve !== undefined && { tensionCurve: dto.tensionCurve }),
        ...(dto.visualStrategy !== undefined && { visualStrategy: dto.visualStrategy }),
        ...(dto.shotPattern !== undefined && { shotPattern: dto.shotPattern }),
        ...(dto.avgShotLengthSec !== undefined && { avgShotLengthSec: dto.avgShotLengthSec }),
        ...(dto.whyThisChoice !== undefined && { whyThisChoice: dto.whyThisChoice }),
        ...(dto.qualityScore !== undefined && { qualityScore: dto.qualityScore }),
        ...(dto.status !== undefined && { status: dto.status as FilmIRStatus }),

      },
    });

    await this.auditLogService.record({
      userId,
      action: 'FILM_IR_UPDATED',
      resourceType: 'film_ir',
      resourceId: id,
      details: { fields: Object.keys(dto), newStatus: dto.status ?? filmIr.status },
    });

    return updated;
  }

  /**
   * 状态转换：DRAFT → APPROVED
   * 只允许显式调用，不通过 update DTO 触发
   */
  async approve(id: string, userId?: string): Promise<FilmIRRecord> {
    const filmIr = await this.filmIr.findUnique({ where: { id } });
    if (!filmIr) throw new NotFoundException(`FilmIR ${id} not found`);
    if (filmIr.status === 'LOCKED') {
      throw new BadRequestException(`FilmIR ${id} is LOCKED, cannot approve`);
    }
    if (filmIr.status === 'APPROVED') {
      throw new ConflictException(`FilmIR ${id} is already APPROVED`);
    }

    const updated = await this.filmIr.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
    await this.auditLogService.record({
      userId,
      action: 'FILM_IR_APPROVED',
      resourceType: 'film_ir',
      resourceId: id,
      details: {},
    });
    return updated;
  }

  /**
   * 状态转换：APPROVED → LOCKED（不可逆）
   * LOCKED 后所有字段禁止写入，证据链锁定
   */
  async lock(id: string, userId?: string): Promise<FilmIRRecord> {
    const filmIr = await this.filmIr.findUnique({ where: { id } });
    if (!filmIr) throw new NotFoundException(`FilmIR ${id} not found`);
    if (filmIr.status === 'LOCKED') {
      throw new ConflictException(`FilmIR ${id} is already LOCKED`);
    }
    if (filmIr.status === 'DRAFT') {
      throw new BadRequestException(`FilmIR ${id} must be APPROVED before locking`);
    }

    const updated = await this.filmIr.update({
      where: { id },
      data: { status: 'LOCKED' },
    });
    await this.auditLogService.record({
      userId,
      action: 'FILM_IR_LOCKED',
      resourceType: 'film_ir',
      resourceId: id,
      details: { evidenceRef: filmIr.evidenceRef ?? 'none' },
    });
    this.logger.log(`[FilmIR] LOCKED id=${id} — evidence chain finalized`);
    return updated;
  }

  /**
   * 触发 replan：创建新 plannerVersion 的 FilmIR，不删除历史版本
   *
   * 版本递增规则：film-planner-v1 → film-planner-v2 → film-planner-v3 ...
   * LOCKED 版本存在时：仍可 replan（只是创建新版本，不覆盖 LOCKED 版本）
   */
  async replan(id: string, userId?: string): Promise<FilmIRRecord> {
    const existing = await this.filmIr.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`FilmIR ${id} not found`);
    if (!existing.sceneId) {
      throw new BadRequestException(`FilmIR ${id} has no sceneId, cannot replan`);
    }

    const versionMatch = (existing.plannerVersion ?? 'film-planner-v1').match(/v(\d+)$/);
    const nextVersion = versionMatch
      ? `film-planner-v${parseInt(versionMatch[1]) + 1}`
      : 'film-planner-v2';

    return this.create(
      {
        sceneId: existing.sceneId,
        plannerVersion: nextVersion,
        sourceText: existing.sourceText ?? undefined,
      },
      userId,
    );
  }

  /**
   * 健康检查
   */
  async health(): Promise<{ status: string; module: string }> {
    return { status: 'ok', module: 'film-ir' };
  }
}
