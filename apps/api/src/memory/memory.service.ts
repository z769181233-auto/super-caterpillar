import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';

/**
 * Memory Service
 * CE07/CE08: Story Memory 服务层
 *
 * 当前实现：
 * - short-term / long-term 读取真实数据库记录
 * - update 仅提供接受请求和审计记录的 MVP 语义，返回 PENDING
 */
@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService
  ) {}

  async getShortTermMemory(chapterId: string, userId?: string) {
    const memories = await this.prisma.memoryShortTerm.findMany({
      where: { chapterId },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    if (memories.length > 1) {
      this.logger.error(
        `[MemoryService] Duplicate short-term memories detected for chapterId=${chapterId}: ${memories
          .map((memory) => memory.id)
          .join(', ')}`
      );
      throw new ConflictException(`Duplicate short-term memories detected for chapter ${chapterId}`);
    }
    const memory = memories[0] ?? null;

    // 记录审计日志
    await this.auditLogService.record({
      userId,
      action: 'MEMORY_ACCESS',
      resourceType: 'memory',
      resourceId: chapterId,
      details: { type: 'short-term', chapterId },
    });

    if (!memory) {
      return {
        success: true,
        data: {
          chapterId,
          summary: null,
          characterStates: null,
        },
      };
    }

    return {
      success: true,
      data: {
        chapterId,
        summary: memory.summary,
        characterStates: memory.characterStates,
      },
    };
  }

  async getLongTermMemory(entityId: string, userId?: string) {
    const memories = await this.prisma.memoryLongTerm.findMany({
      where: { entityId },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });
    if (memories.length > 1) {
      this.logger.error(
        `[MemoryService] Duplicate long-term memories detected for entityId=${entityId}: ${memories
          .map((memory) => memory.id)
          .join(', ')}`
      );
      throw new ConflictException(`Duplicate long-term memories detected for entity ${entityId}`);
    }
    const memory = memories[0] ?? null;

    // 记录审计日志
    await this.auditLogService.record({
      userId,
      action: 'MEMORY_ACCESS',
      resourceType: 'memory',
      resourceId: entityId,
      details: { type: 'long-term', entityId },
    });

    if (!memory) {
      return {
        success: true,
        data: {
          entityId,
          entityType: null,
          vectorRef: null,
          metadata: null,
        },
      };
    }

    return {
      success: true,
      data: {
        entityId,
        entityType: memory.entityType,
        vectorRef: memory.vectorRef,
        metadata: memory.metadata,
      },
    };
  }

  async updateMemory(
    body: { type: 'short-term' | 'long-term'; chapterId?: string; entityId?: string; data: any },
    userId?: string
  ) {
    if (body.type === 'short-term' && body.chapterId) {
      // 记录审计日志
      await this.auditLogService.record({
        userId,
        action: 'MEMORY_UPDATE',
        resourceType: 'memory',
        resourceId: body.chapterId,
        details: { type: 'short-term', chapterId: body.chapterId },
      });

      return {
        success: true,
        data: {
          chapterId: body.chapterId,
          status: 'PENDING',
        },
      };
    } else if (body.type === 'long-term' && body.entityId) {
      // 记录审计日志
      await this.auditLogService.record({
        userId,
        action: 'MEMORY_UPDATE',
        resourceType: 'memory',
        resourceId: body.entityId,
        details: { type: 'long-term', entityId: body.entityId },
      });

      return {
        success: true,
        data: {
          entityId: body.entityId,
          status: 'PENDING',
        },
      };
    }

    throw new NotFoundException('Invalid memory type or missing ID');
  }
}
