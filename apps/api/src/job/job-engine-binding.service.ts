/**
 * Stage3-A: Job-Engine 绑定服务
 * 
 * 核心设计：
 * 1. Job → EngineBinding（逻辑绑定，不是物理）
 * 2. Worker 只消费"可执行 Job"，不直接知道 Engine 细节
 * 3. Engine 的失败/超时 = Job 级事件（仍然可审计）
 */

import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EngineConfigStoreService } from '../engine/engine-config-store.service';
import { EngineRegistry } from '../engine/engine-registry.service';
import { JobType, JobEngineBindingStatus } from 'database';

@Injectable()
export class JobEngineBindingService {
  private readonly logger = new Logger(JobEngineBindingService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EngineConfigStoreService) private readonly engineConfigStore: EngineConfigStoreService,
    @Inject(EngineRegistry) private readonly engineRegistry: EngineRegistry,
  ) { }

  /**
   * 根据 JobType 选择 Engine
   * Stage3-A: 必须按 Engine.code(engineKey) 选引擎，确保返回真实 engineId
   * 只选 isActive=true，找不到就返回 null（由 create() 回滚）
   */
  async selectEngineForJob(jobType: JobType): Promise<{ engineId: string; engineKey: string; engineVersionId?: string } | null> {
    // Stage3-A: 根据 JobType 获取 engineKey（通过 EngineRegistry）
    const engineKey = this.engineRegistry.getDefaultEngineKeyForJobType(jobType);
    if (!engineKey) {
      this.logger.warn(`No engine key mapped for jobType: ${jobType}`);
      return null;
    }

    // Stage3-A: 根据 engineKey（即 code）查找 Engine，只选 isActive=true
    const engine = await this.prisma.engine.findFirst({
      where: {
        code: engineKey, // 使用 code 字段查找（与 engineKey 保持一致）
        isActive: true, // 必须激活
        enabled: true, // 同时检查 enabled
      },
    });

    if (!engine) {
      this.logger.warn(`No active engine found for engineKey: ${engineKey}, jobType: ${jobType}`);
      return null;
    }

    // 可选：选择特定版本（如果有默认版本）
    let engineVersionId: string | undefined;
    if (engine.defaultVersion) {
      const version = await this.prisma.engineVersion.findFirst({
        where: {
          engineId: engine.id,
          versionName: engine.defaultVersion,
          enabled: true,
        },
      });
      if (version) {
        engineVersionId = version.id;
      }
    }

    return {
      engineId: engine.id, // 返回真实的 DB engineId
      engineKey: engine.engineKey || engine.code,
      engineVersionId,
    };
  }

  /**
   * 为 Job 绑定 Engine
   */
  async bindEngineToJob(
    jobId: string,
    engineId: string,
    engineKey: string,
    engineVersionId?: string,
    metadata?: any,
  ) {
    const binding = await this.prisma.jobEngineBinding.create({
      data: {
        jobId,
        engineId,
        engineKey,
        engineVersionId,
        status: JobEngineBindingStatus.BOUND,
        metadata: metadata || {},
      },
    });

    this.logger.log(`Bound engine ${engineKey} to job ${jobId}`);
    return binding;
  }

  /**
   * 获取 Job 的 Engine 绑定信息（Worker 不应直接调用，仅用于内部）
   */
  async getBindingForJob(jobId: string) {
    const binding = await this.prisma.jobEngineBinding.findUnique({
      where: { jobId },
      include: {
        engine: true,
        engineVersion: true,
      },
    });

    if (!binding) {
      throw new NotFoundException(`No engine binding found for job ${jobId}`);
    }

    return binding;
  }

  /**
   * 更新绑定状态（EXECUTING）
   */
  async markBindingExecuting(jobId: string) {
    return this.prisma.jobEngineBinding.update({
      where: { jobId },
      data: {
        status: JobEngineBindingStatus.EXECUTING,
        executedAt: new Date(),
      },
    });
  }

  /**
   * 更新绑定状态（COMPLETED）
   */
  async markBindingCompleted(jobId: string) {
    return this.prisma.jobEngineBinding.update({
      where: { jobId },
      data: {
        status: JobEngineBindingStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  /**
   * 更新绑定状态（FAILED）
   */
  async markBindingFailed(jobId: string, errorMessage: string) {
    return this.prisma.jobEngineBinding.update({
      where: { jobId },
      data: {
        status: JobEngineBindingStatus.FAILED,
        errorMessage,
        completedAt: new Date(),
      },
    });
  }
}

